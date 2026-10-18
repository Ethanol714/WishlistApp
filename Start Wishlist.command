#!/bin/bash
# Double-click this file in Finder to start the Wishlist app.
cd "$(dirname "$0")"
exec python3 server.py --open
