#!/usr/bin/env python3
"""Normalize Google Antigravity SDK streaming output for Kanna.

The TypeScript Antigravity manager consumes newline-delimited JSON records.
This bridge keeps that contract while letting Kanna use the official Python SDK
when `KANNA_ANTIGRAVITY_TRANSPORT=sdk` is set.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from typing import Any


def emit(record: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(record, ensure_ascii=False) + "\n")
    sys.stdout.flush()


async def run(prompt: str, model: str | None, effort: str | None) -> None:
    started = time.monotonic()

    try:
        from google.antigravity import Agent, CapabilitiesConfig, LocalAgentConfig
    except Exception as exc:
        emit(
            {
                "type": "error",
                "message": (
                    "Antigravity SDK is not available. Install it with "
                    "`pip install google-antigravity` and ensure the selected "
                    f"Python can import it. Import error: {exc}"
                ),
            }
        )
        return

    config_kwargs: dict[str, Any] = {
        "capabilities": CapabilitiesConfig(),
    }
    if model:
        config_kwargs["model"] = model
    if effort:
        config_kwargs["reasoning_effort"] = effort

    try:
        config = LocalAgentConfig(**config_kwargs)
    except TypeError:
        # The SDK surface may differ across versions; keep the bridge resilient
        # by falling back to the stable no-arg config shown in the README.
        config = LocalAgentConfig(capabilities=CapabilitiesConfig())

    text_parts: list[str] = []

    try:
        async with Agent(config) as agent:
            response = await agent.chat(prompt)

            async for token in response:
                if not isinstance(token, str):
                    token = str(token)
                text_parts.append(token)
                emit({"type": "text", "text": token})

        emit(
            {
                "type": "result",
                "subtype": "success",
                "text": "".join(text_parts),
                "duration_ms": round((time.monotonic() - started) * 1000),
            }
        )
    except Exception as exc:
        emit(
            {
                "type": "result",
                "subtype": "error",
                "text": str(exc),
                "duration_ms": round((time.monotonic() - started) * 1000),
            }
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Kanna Antigravity SDK bridge")
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--model")
    parser.add_argument("--effort")
    args = parser.parse_args()

    asyncio.run(run(args.prompt, args.model, args.effort))


if __name__ == "__main__":
    main()
