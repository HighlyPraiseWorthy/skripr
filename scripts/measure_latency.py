#!/usr/bin/env python3
"""Measure Claude API latency across different max_tokens settings."""
import os, json, time, re, subprocess

# Load Anthropic key from skripr .env.local
key = ""
env_path = os.path.expanduser("~/workspace/skripr/.env.local")
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if line.startswith("ANTHROPIC_API_KEY="):
                key = line.split("=", 1)[1].strip().strip('"').strip("'")
                break

if not key:
    print("ANTHROPIC_API_KEY not found in .env.local")
    exit(1)

print(f"Key: {key[:10]}...")

prompt_body = (
    "You are a YouTube script analyst. Analyze this source video transcript "
    "and generate a script for a NEW different-topic video, EXACT same structural pattern.\n\n"
    "Source: tech review. Transcript excerpt: "
    "The iPhone 17 Pro Max has some incredible new features. The camera system is completely "
    "redesigned with a 48MP main sensor and 5x optical zoom telephoto. The A19 Bionic chip "
    "is built on a 3nm process and delivers up to 40% faster CPU. Battery life improved by 2 hours. "
    "The display is a 6.9-inch Super Retina XDR. USB-C replaces Lightning. Price: $1199 for 256GB.\n\n"
    "NEW target topic: Samsung Galaxy S25 Ultra Review\n"
    "Target niche: tech reviews\nVideo length: medium (~5-8 min, 700-1200 words)\n\n"
    "Output JSON with this exact structure:\n"
    '{"title":"string","hook":"string","sections":[{"id":"s1","type":"hook|intro|point|story|transition|cta|outro","title":"string","content":"string","duration":number,"retentionBeat":true,"notes":"string"}],"cta":"string","fullScript":"string — complete combined script ~800 words","wordCount":number,"estimatedDuration":number,"ttsTimings":[{"afterLine":number,"pauseMs":number,"emphasis":"normal|strong|whisper"}]}'
)

for max_tokens in [4096, 3072, 2048]:
    payload = {
        "model": "claude-sonnet-4-6",
        "max_tokens": max_tokens,
        "system": "Return valid JSON matching the requested schema. No markdown. No extra text.",
        "messages": [{"role": "user", "content": prompt_body}],
    }

    start = time.time()
    result = subprocess.run(
        ['curl', '-s', '-X', 'POST', 'https://api.anthropic.com/v1/messages',
         '-H', f'x-api-key: {key}',
         '-H', 'anthropic-version: 2023-06-01',
         '-H', 'Content-Type: application/json',
         '-d', json.dumps(payload)],
        capture_output=True, text=True, timeout=120
    )
    elapsed = time.time() - start

    data = json.loads(result.stdout)
    usage = data.get('usage', {})
    content_items = data.get('content', [])
    content_text = content_items[0].get('text', '') if content_items else ''
    stop_reason = data.get('stop_reason', 'unknown')

    # Validate JSON
    try:
        m = re.search(r'\{[\s\S]*\}', content_text)
        parsed = json.loads(m[0]) if m else None
        full_ok = parsed and bool(parsed.get('fullScript', ''))
        words = len(parsed['fullScript'].split()) if full_ok else 0
        print(f"max_tokens={max_tokens:5d}: {elapsed:5.1f}s | out={usage.get('output_tokens','?'):4d}tok | json={len(content_text):6d}c | fullScript={'OK '+str(words)+'w' if full_ok else 'MISSING'}")
    except Exception as e:
        print(f"max_tokens={max_tokens:5d}: {elapsed:5.1f}s | JSON INVALID ({str(e)[:60]})")
