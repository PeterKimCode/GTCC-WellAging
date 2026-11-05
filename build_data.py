"""Compatibility entry point for the shared site builder."""
from pathlib import Path
import subprocess
subprocess.run(['node', str(Path(__file__).parent / 'scripts' / 'build-site.cjs')], check=True)
