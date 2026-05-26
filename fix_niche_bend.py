"""fix_niche_bend.py — final structural repair of niche-bend/page.tsx"""
from pathlib import Path

p = Path("/Users/antondavids/workspace/skripr/src/app/dashboard/niche-bend/page.tsx")
lines = p.read_text().splitlines()
n0 = len(lines)
print(f"Start: {n0} lines")

SCORE_CLOSE  = ")}"
VM_TAG       = "/* ── Viral Magnet (shared) ─────────────────── */"
VM_DIV_CLOSE = '</div>'
H3_SCORE     = "Bend Potential Score"

# ── L441: HTML comment → JSX comment ────────────────────────────────────────
assert lines[440].strip() == "<!-- ── Score card ── -->"
lines[440] = "            {/* ── Score card ── */}"
print("Step 1: L441 comment fixed.")

# Helper: print a slice
def show(s, e, lbl):
    print(f"\n--- {lbl} ---")
    for i in range(s, min(e, len(lines))):
        ind = len(lines[i]) - len(lines[i].lstrip())
        print(f"  L{i+1} ind={ind:2} | {lines[i].strip()[:80]}")

# ── Stray + duplicate region (L477–489) ──────────────────────────────────────
# The first complete score card ends at L439 (ind=8) with `)}`  ✅
# L477=</div> + L478=}) — this is the CORRECT close of the score card
# L479 = ind=12 stray `)}`
# L480–489 = duplicate score card
assert lines[477].strip() == "</div>"
assert lines[478].strip() == ")"
# Delete L479 (stray brace)
stray = lines.pop(478)
print(f"Step 2a: deleted stray line {478+1}: {stray!r}")
# Verify duplicate is now at index 478
assert H3_SCORE in lines[478], f"No duplicate at new L479. Got: {lines[478]!r}"
show(478, 494, "Duplicate before delete")
# Find where duplicate ends: the `)` that closes `selectedNiche && selectedAdjacent && (`
dup_end = None
for i in range(478, len(lines)):
    stripped = lines[i].strip()
    if stripped == ")" and lines[i].startswith("            )"):
        dup_end = i
        break
assert dup_end is not None
# Delete entire duplicate
deleted = lines[478:dup_end+1]
print(f"Deleting lines 479-{dup_end+1} ({len(deleted)} lines)")
del lines[478:dup_end+1]
print(f"Step 2b: duplicate score card deleted.")
show(476, 496, "Region after duplicate removal")

# ── Step 3: Dedent Viral Magnet (shared) block ───────────────────────────────
vm_idx = None
for i, l in enumerate(lines):
    if VM_TAG in l:
        vm_idx = i
        break
assert vm_idx is not None, "Viral Magnet (shared) tag not found"
print(f"\nStep 3: VM(shared) at L{vm_idx+1}, ind={len(lines[vm_idx])-len(lines[vm_idx].lstrip())}")
show(vm_idx, vm_idx+65, "VM(shared) BEFORE fix")

# The block runs from vm_idx to the closing `)` at ind=12  (<code>lines[X].strip()==")"</code> && startsWith ind=12)
vm_block_end = None
for i in range(vm_idx, min(vm_idx+80, len(lines))):
    stripped = lines[i].strip()
    if stripped == ")" and lines[i].startswith("            )"):
        vm_block_end = i
        break
assert vm_block_end is not None, f"Could not find VM block end"
# The closing dividers inside: dedent `            </div>` → `        </div>` etc
for i in range(vm_idx, vm_block_end+1):
    line = lines[i]
    stripped = line.strip()
    if not stripped:
        continue
    ind = len(line) - len(line.lstrip())
    if ind == 12:
        lines[i] = "        " + stripped   # dedent 12 → 8
print(f"VM(shared) block dedented L{vm_idx+1}-{vm_block_end+1}.")
show(vm_idx, vm_block_end+5, "VM(shared) AFTER fix")

# ── Step 4: dedent Generate button block ─────────────────────────────────────
gen_idx = None
for i, l in enumerate(lines):
    if "Generate button" in l:
        gen_idx = i
        break
assert gen_idx is not None, "Generate button comment not found"
print(f"\nStep 4: Gen button at L{gen_idx+1}, ind={len(lines[gen_idx])-len(lines[gen_idx].lstrip())}")
show(gen_idx, gen_idx+30, "Gen button BEFORE fix")
# Dedent lines at ind=12 in this block
for i in range(gen_idx, gen_idx+30):  # enough to cover the button block
    if i >= len(lines):
        break
    line = lines[i]
    stripped = line.strip()
    if not stripped:
        continue
    ind = len(line) - len(line.lstrip())
    if ind == 12:
        lines[i] = "        " + stripped
show(gen_idx, gen_idx+32, "Gen button AFTER fix")

# ── Step 5: Remove second wrapper + dedent secondary VM block ─────────────────
# Find second `{selectedNiche && selectedAdjacent && (`
nsh_idx = None
for i, l in enumerate(lines):
    if W_OPEN := "selectedNiche && selectedAdjacent && (" in l:
        nsh_idx = i
        break
assert nsh_idx is not None, "Second wrapper not found"
print(f"\nStep 5: Second {W_OPEN!r} at L{nsh_idx+1}")
show(nsh_idx, nsh_idx+5, "Second wrapper open")
# Delete the open line
del lines[nsh_idx]
print(f"Deleted L{nsh_idx+1} (second wrapper open).")

# ── Step 6: Dedent the secondary VM Picker block (previously ind=26,14, now shifted) ──
# After deleting one line, find "Viral Magnet Picker" comment → find inner block start → dedent ≥14
vm2_tag = "/* ─── Viral Magnet Picker ─── */"
vm2_idx = None
for i, l in enumerate(lines):
    if vm2_tag in l:
        vm2_idx = i
        break
assert vm2_idx is not None
show(vm2_idx, vm2_idx+80, "Secondary VM BEFORE dedent")
# Find the start of the actual content (the `{magnetWords.length > 0 && (` line)
vm2_start = None
for i in range(vm2_idx, vm2_idx+80):
    if "magnetWords.length > 0" in lines[i]:
        vm2_start = i
        break
assert vm2_start is not None
# Dedent every ind >=14 inside this block until the )})
vm2_end = None
for i in range(vm2_start, vm2_start+200):
    stripped = lines[i].strip()
    if stripped == "))" and lines[i].startswith("            ))":  # type
        vm2_end = i
        break
assert vm2_end is not None, "Secondary VM end not found"
print(f"Secondary VM block L{vm2_start+1}-{vm2_end+1}, ind={len(lines[vm2_start])-len(lines[vm2_start].lstrip())}")
for i in range(vm2_start, vm2_end+1):
    line = lines[i]
    stripped = line.strip()
    if not stripped:
        continue
    ind = len(line) - len(line.lstrip())
    if ind >= 14:
        lines[i] = "  " + stripped  # reduce by 4
show(vm2_start, vm2_end+5, "Secondary VM AFTER dedent")

# ── Step 7: Dedent the ideas/generate section that was inside second wrapper now un-wrapped
# lines from vm2_idx (now at some index) down to end — dedent ind=12 → 8

# Find where the ideas section starts  (ideas.length > 0)
ideas_idx = None
for i, l in enumerate(lines):
    if "ideas.length > 0" in l:
        ideas_idx = i
        break
assert ideas_idx is not None
show(ideas_idx, ideas_idx+20, "Ideas list BEFORE dedent")

# Target lines at ind=12 inside this section (down to closing `)} ` for ideas block)
ideas_end = None
for i in range(ideas_idx, len(lines)-1, -1):
    ind = len(lines[i]) - len(lines[i].lstrip())
    if lines[i].strip() == ")" and ind == 8:
        ideas_end = i
        break
assert ideas_end is not None, f"Ideas end not found from {ideas_idx}"
print(f"Ideas section: L{ideas_idx+1}(ind={len(lines[ideas_idx])-len(lines[ideas_idx].lstrip())}) - L{ideas_end+1}")

for i in range(ideas_idx, ideas_end+1):
    line = lines[i]
    stripped = line.strip()
    if not stripped:
        continue
    ind = len(line) - len(line.lstrip())
    if ind == 12:
        lines[i] = "        " + stripped
show(ideas_idx, ideas_end+4, "Ideas section AFTER dedent")

# ── Step 8: final count and write ─────────────────────────────────────────────
txt2 = "\n".join(lines)
# Ensure trailing newline
if not txt2.endswith("\n"):
    txt2 += "\n"
p.write_text(txt2)
print(f"\n\nDONE. {len(txt2.splitlines())} lines (was {n0}).")
print(f"Size: {len(txt2)} bytes")
