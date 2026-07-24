import sys
import os

# Add root directory to python module path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app

__all__ = ["app"]
