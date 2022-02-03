#!/usr/bin/sh

for folder in ./*/; do
name=$(echo $folder | sed "s/[^[:alpha:]]//g");
cp convert.spec.ts.template $folder/$name.spec.ts
done;