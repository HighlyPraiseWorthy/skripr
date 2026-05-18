#!/usr/bin/env python3
"""Test if a smaller Anthropic model (haiku/sonnet 3.5) can do the script task with acceptable latency."""
import os, json, time, re, subprocess

key_line = ""
env_path = os.path.expanduser("~/workspace/skripr/.env.local")
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if line.startswith("ANTHROPIC_API_KEY="):
                key_line = line.split("=", 1)[1].strip().strip('"').strip("'")
                break

if not key_line:
    print("No ANTHROPIC_API_KEY"); exit(1)

prompt_body = (
    "You are a YouTube script analyst. Generate a script for a YouTube video.\n\n"
    "Source niche: tech reviews\n"
    "Source transcript (abbreviated): The iPhone 17 Pro Max has a 48MP camera, 5x optical zoom, "
    "A19 Bionic chip, 6.9-inch display, USB-C, battery life up 2 hours, price $1199 for 256GB.\n\n"
    "Target topic: Samsung Galaxy S25 Ultra Review\n"
    "Target niche: tech reviews\n"
    "Video length: medium (~5-8 min, 700-1200 words)\n\n"
    "Output ONLY valid JSON (no markdown, no explanation):\n"
    '{"title":"string","hook":"string","sections":[{"id":"s1","type":"hook|intro|point|story|transition|cta|outro","title":"string","content":"string","duration":60,"retentionBeat":true,"notes":"string"}],"cta":"string","fullScript":"string — complete combined script ~800 words","wordCount":800,"estimatedDuration":420,"ttsTimings":[{"afterLine":1,"pauseMs":0,"emphasis":"normal"}]}'
)

models = [
    # (model_name, max_tokens)
    ("claude-3-5-sonnet-20241022", 4096),
    # ("claude-3-5-haiku-20241022", 4096),
    # ("claude-sonnet-4-6", 4096),
]

for model, max_tokens in models:
    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "system": "Return valid JSON matching the requested schema. No markdown. No extra text.",
        "messages": [{"role": "user", "content": prompt_body}],
    }
    start = time.time()
    result = subprocess.run(
        ['curl', '-s', '-X', 'POST', 'https://api.anthropic.com/v1/messages',
         '-H', f'x-api-key: {key_line}',
         '-H', 'anthropic-version: 2023-06-01',
         '-H', 'Content-Type: application/json',
         '-d', json.dumps(payload)],
        capture_output=True, text=True, timeout=120
    )
    elapsed = time.time() - start

    try:
        data = json.loads(result.stdout)
        if 'error' in data:
            print(f"{model}: {elapsed:.1f}s | ERROR: {data['error'].get('message', '?')[:100]}")
            continue
        usage = data.get('usage', {})
        ct = data['content'][0]['text'] if data.get('content') else ''
        m = re.search(r'\{[\s\S]*\}', ct)
        parsed = json.loads(m[0]) if m else None
        full_ok = bool(parsed and parsed.get('fullScript', ''))
        words = len(parsed['fullScript'].split()) if full_ok else 0
        print(f"{model}: {elapsed:.1f}s | out={usage.get('output_tokens','?'):4d}tok | fullScript={'OK '+str(words)+'w' if full_ok else 'MISSING'}")
    except Exception as e:
        print(f"{model}: {elapsed:.1f}s | FAIL: {str(e)[:80]}")
