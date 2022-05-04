import path from 'path'
const script = process.argv[2]
const main = require(path.join(__dirname, script + '.ts')).default // eslint-disable-line
console.time(script)
main(process.argv.slice(3)).then(() => {
  console.timeEnd(script)
  process.exit()
})
