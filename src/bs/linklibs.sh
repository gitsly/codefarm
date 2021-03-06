#!/bin/bash -e

set +x

if [ -n "${DISABLE_LINK_LIBS}" ]; then
    echo "Link libs is disabled! Exiting..."
    exit 0
fi

# gitroot is set from outside if not a git repo
if [ -z "$gitroot" ]; then
    gitroot=$(git rev-parse --show-toplevel)
fi
source $gitroot/src/bs/common.source

production=0
if [ "${NODE_ENV}" == "production" ]; then
    echo "$0: Production mode, will copy linked deps"
    production=1
fi

libs=$(node -e "const p = require('./package.json'); console.log(p.libraries.join('\n'));")
libdir=$(node -e "const p = require('path'); console.log(p.relative(process.cwd(), '$gitroot/src/lib'));")

installFlag=""
if [[ $production -eq 1 ]]; then
    installFlag="--production"
fi

install="npm install ${installFlag}"
install_pkg=$install

if command -v yarn ; then
    install="yarn ${installFlag}"
fi

while read -r lib; do
    if [[ $production -eq 1 ]]; then
        echo "Installing library dependency: $libdir/$lib"
        gitroot=$gitroot $install_pkg $libdir/$lib
    else
        if [ ! -e "./node_modules/$lib" ]; then
            ln -s "../$libdir/$lib" "./node_modules/"
        fi

        if [ -L "./node_modules/$lib" ]; then
            pushd "./node_modules/$lib"
            $install
            popd
        fi
    fi
done <<< "$libs"
