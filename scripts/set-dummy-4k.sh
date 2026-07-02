#!/bin/bash
# Wait for dummy display to initialize
sleep 5
# Find the dummy display ID and set it to 4K
DUMMY_ID=$(displayplacer list 2>/dev/null | grep -B3 's12345' | grep 'Persistent' | awk '{print $NF}')
if [ -n "$DUMMY_ID" ]; then
    MAIN_ID=$(displayplacer list 2>/dev/null | grep -B0 'Contextual screen id: 1$' | grep 'Persistent' | awk '{print $NF}')
    displayplacer "id:$DUMMY_ID res:2560x1440 hz:60 color_depth:4 enabled:true scaling:on origin:(0,0) degree:0" 2>/dev/null
    echo "$(date): Dummy display $DUMMY_ID set to 4K" >> /Users/clawdboot/sonty/logs/dummy4k.log
fi
