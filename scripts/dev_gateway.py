#!/usr/bin/env python3
"""Local development only: give a seeded property a working gateway credential.

The seed creates properties, areas and nodes but no gateway, and telemetry needs a gateway
credential (`gk_...`). This script does what an admin plus a device would do, through the
public API: provision the gateway for every area of the property, issue a one-time
activation reference, activate it, and print the credential and the logical node ids for
`simulator/simulator.py`.

    python3 scripts/dev_gateway.py --property-id 1
    python3 scripts/dev_gateway.py --property-id 1 --base-url http://localhost:5050/api/v1

Never point it at a shared or production server: it creates a gateway there.
Stdlib only, so it runs without the backend virtualenv.
"""

import argparse
import json
import sys
import urllib.error
import urllib.request


def call(method, url, body=None, token=None):
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(url, data=data, method=method)
    request.add_header("Content-Type", "application/json")
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            raw = response.read()
    except urllib.error.HTTPError as error:
        sys.exit(f"{method} {url} -> {error.code}: {error.read().decode(errors='replace')}")
    return json.loads(raw) if raw else None


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--property-id", type=int, required=True)
    parser.add_argument("--base-url", default="http://localhost:5050/api/v1")
    parser.add_argument("--email", default="admin@sensores.com")
    parser.add_argument("--password", default="admin123")
    args = parser.parse_args()
    base = args.base_url.rstrip("/")

    token = call("POST", f"{base}/auth/login", {"email": args.email, "password": args.password})["access_token"]
    areas = call("GET", f"{base}/irrigation-areas?property_id={args.property_id}&page=1&per_page=100", token=token)
    area_ids = [area["id"] for area in areas["data"]]
    if not area_ids:
        sys.exit(f"property {args.property_id} has no irrigation areas")

    gateway = call(
        "POST", f"{base}/gateways",
        {"property_id": args.property_id, "slots": [{"irrigation_area_id": i} for i in area_ids]},
        token=token,
    )
    reference = call("POST", f"{base}/gateways/{gateway['id']}/activation-references", token=token)
    credential = call("POST", f"{base}/gateways/activate", {"activation_reference": reference["activation_reference"]})

    node_ids = [slot["logical_node_id"] for slot in gateway["slots"]]
    print(f"gateway_id={credential['gateway_id']} property_id={credential['property_id']}")
    print(f"SIM_GATEWAY_KEY={credential['credential']}")
    print(f"SIM_LOGICAL_NODE_IDS={','.join(str(n) for n in node_ids)}")


if __name__ == "__main__":
    main()
