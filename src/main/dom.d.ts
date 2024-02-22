export {}

// @aws-sdk/client-dynamodb version 3.150.0 causes the build to fail if targeting a Nodejs environment instead of dom,
// since it expects several types that are available only in the browser.
// See https://stackoverflow.com/a/69581652/17092655.
declare global {
  type ReadableStream = unknown
  type Blob = unknown
  type File = unknown
}
