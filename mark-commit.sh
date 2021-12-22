#!/usr/bin/env bash
set -eu

if [ $# -ne 2 ]; then
  echo "Usage: $0 <output file> <initial offset>"
  exit 1
fi

if [ ! -f "$1" ]; then
    touch "$1"
fi

offset=$2
while true; do
  commit_offset_rev="HEAD~$offset"
  commit_hash=$(git rev-parse "$commit_offset_rev")
  if [ $? -ne 0 ]; then
    exit 0
  fi

  clear
  GIT_PAGER="less -+F -RSX" git show "$commit_hash" || true
  clear
  read -p "Was that commit ($commit_offset_rev) interesting?" -n 1 -r
  echo "$commit_hash" "$REPLY" >> $1

  offset=$((offset+1))
done
