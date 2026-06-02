import { discoverProjects } from "./packages/server/src/discovery"

const projects = discoverProjects()
console.log("Discovered Projects:")
console.log(JSON.stringify(projects, null, 2))
