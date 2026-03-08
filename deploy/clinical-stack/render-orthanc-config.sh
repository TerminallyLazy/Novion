#!/bin/sh

set -eu

escape_json_sed() {
  printf '%s' "$1" | sed \
    -e 's/\\/\\\\/g' \
    -e 's/"/\\"/g' | sed \
    -e 's/[&|\\]/\\&/g'
}

username_escaped=$(
  escape_json_sed "${RADSYSX_ORTHANC_USERNAME:?Set RADSYSX_ORTHANC_USERNAME}"
)
password_escaped=$(
  escape_json_sed "${RADSYSX_ORTHANC_PASSWORD:?Set RADSYSX_ORTHANC_PASSWORD}"
)

sed \
  -e "s|__RADSYSX_ORTHANC_USERNAME__|${username_escaped}|g" \
  -e "s|__RADSYSX_ORTHANC_PASSWORD__|${password_escaped}|g" \
  /etc/orthanc/orthanc.json > /tmp/orthanc.json

exec Orthanc /tmp/orthanc.json
