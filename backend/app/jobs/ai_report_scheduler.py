import os
import time
from datetime import UTC, datetime
from urllib import error

from app.core.scheduler_client import SchedulerApiClient
from app.core.time import utc_now


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def should_run_now(
    *,
    enabled: bool,
    now: datetime,
    schedule_hour: int,
    schedule_minute: int,
    last_run_day: str | None,
) -> bool:
    today_key = now.strftime("%Y-%m-%d")
    reached_schedule = (
        (now.hour > schedule_hour)
        or (now.hour == schedule_hour and now.minute >= schedule_minute)
    )
    return enabled and reached_schedule and last_run_day != today_key


def main() -> None:
    base_url = os.getenv("BACKEND_API_URL", "http://backend:5050/api/v1")
    email = os.getenv("SCHEDULER_ADMIN_EMAIL", "")
    password = os.getenv("SCHEDULER_ADMIN_PASSWORD", "")
    timeout_seconds = int(os.getenv("AI_REPORTS_HTTP_TIMEOUT_SECONDS", "30"))

    enabled = os.getenv("AI_REPORTS_SCHEDULER_ENABLED", "false").lower() == "true"
    notify = os.getenv("AI_REPORTS_DEFAULT_NOTIFY", "false").lower() == "true"
    force = os.getenv("AI_REPORTS_SCHEDULER_FORCE", "false").lower() == "true"
    poll_seconds = int(os.getenv("AI_REPORTS_SCHEDULER_POLL_SECONDS", "60"))
    schedule_hour = int(os.getenv("AI_REPORTS_SCHEDULE_HOUR_UTC", "2"))
    schedule_minute = int(os.getenv("AI_REPORTS_SCHEDULE_MINUTE_UTC", "0"))

    if not email or not password:
        raise RuntimeError(
            "Missing scheduler credentials: set SCHEDULER_ADMIN_EMAIL and "
            "SCHEDULER_ADMIN_PASSWORD"
        )

    if schedule_hour < 0 or schedule_hour > 23:
        raise RuntimeError("AI_REPORTS_SCHEDULE_HOUR_UTC must be between 0 and 23")
    if schedule_minute < 0 or schedule_minute > 59:
        raise RuntimeError("AI_REPORTS_SCHEDULE_MINUTE_UTC must be between 0 and 59")

    client = SchedulerApiClient(
        base_url=base_url,
        email=email,
        password=password,
        timeout_seconds=timeout_seconds,
    )

    print(f"[{_now_iso()}] AI report scheduler started")
    print(
        f"[{_now_iso()}] Target={base_url}, enabled={enabled}, "
        f"run_at={schedule_hour:02d}:{schedule_minute:02d} UTC, poll={poll_seconds}s"
    )

    last_run_day: str | None = None

    while True:
        now = utc_now()
        today_key = now.strftime("%Y-%m-%d")
        should_run = should_run_now(
            enabled=enabled,
            now=now,
            schedule_hour=schedule_hour,
            schedule_minute=schedule_minute,
            last_run_day=last_run_day,
        )

        if should_run:
            try:
                result = client.post_authenticated(
                    "/ai-reports/generate",
                    {"notify": notify, "force": force},
                )
                last_run_day = today_key
                print(
                    f"[{_now_iso()}] Generate ok: generated={result.get('generated_count')}, "
                    f"skipped={result.get('skipped_count')}, failed={result.get('failed_count')}"
                )
            except error.HTTPError as exc:
                detail = exc.read().decode("utf-8", errors="ignore")
                print(
                    f"[{_now_iso()}] Generate http error: status={exc.code}, detail={detail}"
                )
            except error.URLError as exc:
                print(f"[{_now_iso()}] Generate url error: {exc}")
            except Exception as exc:
                print(f"[{_now_iso()}] Generate error: {exc}")

        time.sleep(poll_seconds)


if __name__ == "__main__":
    main()
