import sys
import os

# Add project root directory to sys.path so backend module can be imported
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
root_dir = os.path.dirname(parent_dir)

for d in [current_dir, parent_dir, root_dir]:
    if d not in sys.path:
        sys.path.insert(0, d)

from backend.main import app

__all__ = ["app"]
