import path from 'path'
const script = process.argv[2]
import(path.join(__dirname, script + '.ts')).then(main => {
  console.time(script)
  main.default(process.argv.slice(3)).then(() => {
    console.timeEnd(script)
    process.exit()
  })
})
