#!/usr/bin/env bash
set -e

cat doc/interesting-commits.txt | choose 0 | sort -R | GIT_PAGER="less -+F -RSX" xargs -IHASH bash -c 'git show HASH || true'