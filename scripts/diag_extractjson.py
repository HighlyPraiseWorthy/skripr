#!/usr/bin/env python3
"""Diagnose extractJSON failure — what does Claude actually return?"""
import os, json, time, re, subprocess

key_line = ""
env_path = os.path.expanduser("~/workspace/skripr/.env.local")
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if line.startswith("ANTHROPIC_API_KEY="):
                key_line = line.split("=", 1)[1].strip().strip('"').strip("'")
                break

def check_json(s):
    try:
        json.loads(s)
        return True, ""
    except Exception as e:
        return False, str(e)

def find_error_pos(block, err):
    import re
    m = re.search(r'position (\d+)', err)
    return int(m.group(1)) if m else -1

real_prompt = (
    "You are a YouTube script analyst. Output valid JSON only, no markdown.\n"
    "Source: tech review. Transcript: The iPhone 17 Pro Max has a 48MP camera, 5x optical zoom, "
    "A19 Bionic chip, 6.9-inch display, USB-C, 2hr better battery, $1199 for 256GB.\n"
    "Target: Samsung Galaxy S25 Ultra Review. Video length: medium (~700-1200 words).\n\n"
    'JSON: {"title":"string","hook":"string","sections":[{"id":"s1","type":"hook|intro|point|story|transition|cta|outro","title":"string","content":"string","duration":9000,"retentionBeat":true,"notes":"string"}],"cta":"string","fullScript":"string ~800 words","wordCount":number,"estimatedDuration":number,"ttsTimings":[{"afterLine":number,"pauseMs":number,"emphasis":"normal|strong|whisper"}]}'
)

payload = {"model": "claude-sonnet-4-6", "max_tokens": 4096,
    "system": "Return valid JSON only.",
    "messages": [{"role": "user", "content": real_prompt}]}

t0 = time.time()
r = subprocess.run(
    ['curl', '-s', '-X', 'POST', 'https://api.anthropic.com/v1/messages',
     '-H', 'x-api-key: ' + key_line,
     '-H', 'anthropic-version: 2023-06-01',
     '-H', 'Content-Type: application/json',
     '-d', json.dumps(payload)],
    capture_output=True, text=True, timeout=120,
)
dt = time.time() - t0
data = json.loads(r.stdout)
content_text = data['content'][0]['text']

print("Wall time:        {:.1f}s".format(dt))
print("Output tokens:    {} (claimed)".format(data['usage']['output_tokens']))
print("Stop reason:      {}".format(data['stop_reason']))
print("Response length:  {} chars".format(len(content_text)))
print("Last 200 chars:   {}".format(repr(content_text[-200:])))
print()

# Strategy 1: code block
m1 = re.search(r'```(?:json)?\s*\n([\s\S]*?)```', content_text)
if m1:
    ok, err = check_json(m1[1])
    print("Strategy 1 (code block):  {} inner chars — {}".format(len(m1[1]), 'VALID' if ok else 'INVALID: '+err[:80]))

# Strategy 2: lazy match
m2 = re.search(r'\{[\s\S]*?\}', content_text)
if m2:
    ok, err = check_json(m2[0])
    print("Strategy 2 (lazy {{}}):     {} chars — {}".format(len(m2[0]), 'VALID' if ok else 'INVALID: '+err[:80]))

# Strategy 3: greedy match
m3 = re.search(r'\{[\s\S]*\}', content_text)
if m3:
    block = m3[0]
    ok, err = check_json(block)
    pos = find_error_pos(block, err)
    print("Strategy 3 (greedy {{}}):   {} chars — {}".format(len(block), 'VALID' if ok else 'INVALID pos='+str(pos)))
    if not ok:
        start = max(0, pos - 80)
        snippet = block[start:start+160]
        print("  Context around error: {}".format(repr(snippet)))

# Save full response
with open('/tmp/claude_raw_latest.txt', 'w') as f:
    f.write(content_text)
print("\nFull response saved to /tmp/claude_raw_latest.txt ({} chars)".format(len(content_text)))
