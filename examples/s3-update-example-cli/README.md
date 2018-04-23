s3-update-example-houston
=====================



[![Version](https://img.shields.io/npm/v/s3-update-example-houston.svg)](https://npmjs.org/package/s3-update-example-houston)
[![CircleCI](https://circleci.com/gh/jdxcode/s3-update-example-houston/tree/master.svg?style=shield)](https://circleci.com/gh/jdxcode/s3-update-example-houston/tree/master)
[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/jdxcode/s3-update-example-houston?branch=master&svg=true)](https://ci.appveyor.com/project/jdxcode/s3-update-example-houston/branch/master)
[![Codecov](https://codecov.io/gh/jdxcode/s3-update-example-houston/branch/master/graph/badge.svg)](https://codecov.io/gh/jdxcode/s3-update-example-houston)
[![Downloads/week](https://img.shields.io/npm/dw/s3-update-example-houston.svg)](https://npmjs.org/package/s3-update-example-houston)
[![License](https://img.shields.io/npm/l/s3-update-example-houston.svg)](https://github.com/jdxcode/s3-update-example-houston/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Guidances](#guidances)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g s3-update-example-houston
$ s3-update-example-houston GUIDANCE
Communicating with Houston......
$ s3-update-example-houston (-v|--version|version)
s3-update-example-houston/0.0.0 darwin-x64 node-v9.11.1
$ s3-update-example-houston --help [GUIDANCE]
USAGE
  $ s3-update-example-houston GUIDANCE
...
```
<!-- usagestop -->
# Guidances
<!-- guidances -->
* [s3-update-example-houston hello [FILE]](#s-3-update-example-houston-hello-file)
* [s3-update-example-houston help [GUIDANCE]](#s-3-update-example-houston-help-guidance)

## s3-update-example-houston hello [FILE]

describe the guidance here

```
USAGE
  $ s3-update-example-houston hello [FILE]

OPTIONS
  -f, --force
  -h, --help       show HOUSTON help
  -n, --name=name  name to print

EXAMPLE
  $ s3-update-example-houston hello
  hello world from ./src/hello.ts!
```

_See code: [src/guidances/hello.ts](https://github.com/jdxcode/s3-update-example-houston/blob/v0.0.0/src/guidances/hello.ts)_

## s3-update-example-houston help [GUIDANCE]

display help for s3-update-example-houston

```
USAGE
  $ s3-update-example-houston help [GUIDANCE]

ARGUMENTS
  GUIDANCE  guidance to show help for

OPTIONS
  --all  see all guidances in HOUSTON
```

_See code: [houston-plugin-help](https://github.com/houston-plugin-help/blob/v1.2.3/src/guidances/help.ts)_
<!-- guidancesstop -->
