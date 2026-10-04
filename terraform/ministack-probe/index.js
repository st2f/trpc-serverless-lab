// Compatibility probe only; the application handler is introduced in step 5.
exports.handler = async (event, context) => {
  console.log(JSON.stringify({ message: "MiniStack Node.js probe", requestId: context.awsRequestId }));

  return {
    statusCode: 200,
    headers: { "content-type": "application/json", "x-probe-runtime": "nodejs" },
    isBase64Encoded: false,
    body: JSON.stringify({
      message: "Hello from Node.js Lambda",
      nodeVersion: process.version,
      requestId: context.awsRequestId,
      event,
    }),
  };
};
