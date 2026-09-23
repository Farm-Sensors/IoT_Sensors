"""Offline wire-contract validation; this does not simulate gateway authorization or storage."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / "contracts/edge-cloud/v2"
OPERATIONS = {
    "activation",
    "configuration",
    "candidate",
    "confirmation",
    "heartbeat",
    "telemetry",
    "ndvi",
    "updateAuthorization",
    "updateConfirmation",
}
PLACEHOLDERS = {
    "<gateway-credential>": "gk_contract_test_only",
    "<activation-reference>": "ar_contract_test_only",
}
STATUS = {
    "inactive": "pending",
    "never_seen": "pending",
    "recently_seen": "connected",
    "stale": "delayed",
    "disconnected": "disconnected",
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def load(path):
    return json.loads(path.read_text())


def check_manifest(directory, manifest, excluded=()):
    entries = {}
    for line in manifest.read_text().splitlines():
        digest, name = line.split("  ", 1)
        require(name not in entries, f"Duplicate checksum entry: {name}")
        path = directory / name
        require(
            path.resolve().is_relative_to(directory.resolve()), "Unsafe checksum path"
        )
        require(
            path.is_file() and not path.is_symlink(), f"Missing/unsafe file: {name}"
        )
        require(
            hashlib.sha256(path.read_bytes()).hexdigest() == digest,
            f"Checksum mismatch: {name}",
        )
        entries[name] = digest
    files = {
        p.relative_to(directory).as_posix() for p in directory.rglob("*") if p.is_file()
    }
    require(
        set(entries) == files - set(excluded),
        "Checksum manifest must cover every package file",
    )


def credential_free(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if key.lower() in {"x-api-key", "credential", "activation_reference"}:
                # legacy-node-fixture is intentionally invalid, never a real credential.
                require(
                    child in (*PLACEHOLDERS, "legacy-node-fixture"), f"Unredacted {key}"
                )
            credential_free(child)
    elif isinstance(value, list):
        for child in value:
            credential_free(child)
    elif isinstance(value, str):
        require(
            not value.startswith(("gk_", "ar_", "eyJ")), "Secret-like fixture string"
        )


def expand(value):
    if isinstance(value, dict):
        return {key: expand(child) for key, child in value.items()}
    if isinstance(value, list):
        return [expand(child) for child in value]
    return PLACEHOLDERS.get(value, value) if isinstance(value, str) else value


class Contract:
    def __init__(self, directory=PACKAGE):
        self.directory = directory.resolve()
        self.operations = load(directory / "operations.json")
        require(set(self.operations) == OPERATIONS, "Incomplete operation catalog")
        resources = []
        for path in directory.glob("*.schema.json"):
            schema = load(path)
            Draft202012Validator.check_schema(schema)
            resources.append((path.resolve().as_uri(), Resource.from_contents(schema)))
        # No network retriever: unknown external references fail closed.
        self.registry = Registry().with_resources(resources)

    def validate(self, reference, value):
        if reference is None:
            require(value is None, "Body must be absent")
            return
        uri = self.directory.as_uri() + "/" + reference
        validator = Draft202012Validator(
            {"$ref": uri},
            registry=self.registry,
            format_checker=FormatChecker(),
        )
        errors = list(validator.iter_errors(expand(value)))
        # Never print request values: activation/auth fixtures use placeholders.
        require(not errors, f"Schema violation: {reference}")

    def case(self, case):
        operation = self.operations[case["operation"]]
        request, response = case["request"], case["response"]
        path_errors = list(
            Draft202012Validator(operation["path_parameters"]).iter_errors(
                request["path_parameters"]
            )
        )
        require(not path_errors, "Invalid path parameters")
        # Canonical fixture spelling; accept case-insensitive wire header names.
        schema_name = operation["headers"].split("/")[-1]
        props = load(self.directory / "machine.schema.json")["$defs"][schema_name][
            "properties"
        ]
        canonical = {key.lower(): key for key in props}
        headers = {
            canonical.get(k.lower(), k): v for k, v in request["headers"].items()
        }
        require(len(request["headers"]) == len(headers), "Duplicate headers")
        self.validate(operation["headers"], headers)
        self.validate(operation["request"], request["body"])
        status = str(response["status"])
        if (
            response["status"] in operation["errors"]
            or 500 <= response["status"] <= 599
        ):
            self.validate(operation["error"], response["body"])
            return
        require(status in operation["responses"], "Undocumented response status")
        self.validate(operation["responses"][status], response["body"])
        if case["operation"] == "configuration":
            current = case["current"]
            match = all(
                headers.get(header) is not None and int(headers[header]) == current[key]
                for header, key in [
                    ("X-Config-Version", "configuration_version"),
                    ("X-Bindings-Revision", "bindings_revision"),
                ]
            )
            require(
                (status == "304") == match, "304 requires both current revision headers"
            )
            if status == "200":
                body = response["body"]
                require(
                    all(body[key] == current[key] for key in current),
                    "Incorrect response revisions",
                )
                require(
                    STATUS[body["cloud_status"]] == body["edge_status"],
                    "Incorrect status mapping",
                )
                require(
                    body["property_id"] == body["configuration"]["property_id"],
                    "Property mismatch",
                )
                slots = body["configuration"]["slots"]
                overlays = body["binding_overlay"]["slots"]

                def identities(rows):
                    return [
                        (r["slot_id"], r["logical_node_id"], r["irrigation_area_id"])
                        for r in rows
                    ]

                require(
                    len(set(identities(slots))) == len(slots),
                    "Duplicate configuration slot",
                )
                require(
                    sorted(identities(slots)) == sorted(identities(overlays)),
                    "Overlay identity mismatch",
                )
                for slot in overlays:
                    expected = {
                        "unbound": (False, False),
                        "pending_initial": (False, True),
                        "confirmed": (True, False),
                        "pending_reassignment": (True, True),
                    }[slot["binding_status"]]
                    require(
                        tuple(
                            slot[k] is not None
                            for k in ("current_binding", "pending_binding")
                        )
                        == expected,
                        "Binding metadata does not match canonical state",
                    )
        if case["operation"] == "telemetry":
            require(
                response["body"]["node_id"] == int(headers["X-Logical-Node-Id"]),
                "Reading node mismatch",
            )
            require(
                response["body"]["timestamp"] == request["body"]["timestamp"],
                "Capture time mismatch",
            )


def validate_package(directory=PACKAGE):
    check_manifest(directory, directory / "SHA256SUMS", ("SHA256SUMS",))
    check_manifest(directory.parent / "v1", directory / "v1-frozen.sha256")
    contract = Contract(directory)
    for kind in ("telemetry", "ndvi"):
        old, new = (
            load(directory.parent / "v1" / f"{kind}.schema.json"),
            load(directory / f"{kind}.schema.json"),
        )
        old.pop("title")
        new.pop("title")
        require(old == new, f"{kind} body must preserve v1 semantics")
        for path in sorted((directory / "fixtures").glob(f"{kind}.*.json")):
            value = load(path)
            credential_free(value)
            try:
                contract.validate(f"{kind}.schema.json", value)
                valid = True
            except ValueError:
                valid = False
            require(
                valid == (".valid." in path.name),
                f"Unexpected fixture result: {path.name}",
            )
    cases = load(directory / "fixtures/machine-cases.json")
    names = {case["name"]: case for case in cases}
    require(len(names) == len(cases), "Duplicate fixture name")
    covered = set()
    for case in cases:
        credential_free(case)
        try:
            contract.case(case)
            valid = True
        except ValueError:
            valid = False
        require(
            valid == case["valid"], f"Unexpected machine fixture result: {case['name']}"
        )
        if valid:
            covered.add((case["operation"], str(case["response"]["status"])))
        if "replay_of" in case:
            original = names[case["replay_of"]]
            require(
                case["operation"] == original["operation"], "Replay operation changed"
            )
            require(
                case["request"] == original["request"], "Exact replay request changed"
            )
            require(
                case["response"]["status"] == 200
                and case["response"]["body"] == original["response"]["body"],
                "Replay must return original result",
            )
        if "conflict_of" in case:
            original = names[case["conflict_of"]]
            require(
                case["operation"] == original["operation"], "Conflict operation changed"
            )
            require(
                case["request"]["headers"] == original["request"]["headers"],
                "Conflict identity changed",
            )
            require(
                case["request"]["body"] != original["request"]["body"],
                "Conflict payload must differ",
            )
            require(
                case["response"]["status"] == 409, "Conflicting retry must return 409"
            )
            if case["operation"] == "ndvi":
                for key in ("irrigation_area_id", "provider", "collection", "scene_id"):
                    require(
                        case["request"]["body"][key]
                        == original["request"]["body"][key],
                        "NDVI conflict must retain scene identity",
                    )
    required = {
        (name, status)
        for name, op in contract.operations.items()
        for status in op["responses"]
    }
    require(required <= covered, "Missing successful operation/status fixture")
    return len(cases)


if __name__ == "__main__":
    count = validate_package()
    print(
        f"PASS: v2 checksums, frozen v1, body schemas and {count} machine fixtures (no runtime claims)"
    )
