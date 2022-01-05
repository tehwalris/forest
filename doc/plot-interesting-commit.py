import sys
import json
import numpy as np
from matplotlib import pyplot as plt
from pathlib import Path
import re

out_dir = Path(__file__).parent.parent / "latex-out/plots"
out_dir.mkdir(exist_ok=True, parents=True)

data = json.load(sys.stdin)

scale = 0.8

temp = [
  [int(k), v]
  for (k, v) in data['commitsByNumberOfEdits'].items()
]
temp.sort(key=lambda x: x[0])
temp = np.array(temp)
plt.figure(figsize=(5, 2))
plt.bar(temp[:, 0], temp[:, 1])
plt.xlabel("Number of edits")
plt.ylabel("Number of commits")
plt.tight_layout()
plt.savefig(str(out_dir / 'edits-per-commit.pdf'))

key_order = [*(str(i) for i in range(2, 11)), '>10']
assert set(data['editsByCursors'].keys()).issubset(key_order)
plt.figure(figsize=(5, 2))
plt.bar(key_order, [data['editsByCursors'].get(k, 0) for k in key_order])
plt.xlabel("Number of cursors")
plt.ylabel("Number of edits")
plt.tight_layout()
plt.savefig(str(out_dir / 'cursors-per-edit.pdf'))