const major = Number(process.versions.node.split('.')[0])

if (major !== 22) {
  console.error(
    `\nThis repository requires Node.js 22.x; the current runtime is ${process.versions.node}.\n` +
      'Install/switch to Node 22, then run npm ci before starting the app.\n',
  )
  process.exit(1)
}
