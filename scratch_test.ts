import { EventStore } from "./packages/server/src/event-store"
import { resolveLocalPath } from "./packages/server/src/paths"

async function run() {
  const store = new EventStore()
  // Wait for store to be loaded
  await new Promise(resolve => setTimeout(resolve, 1000))

  const testPath = resolveLocalPath("/Users/tonypham/MEGA/WebApp/kanna")
  console.log("1. Opening project for path:", testPath)
  try {
    const project = await store.openProject(testPath)
    console.log("2. Project opened successfully:", project)
    console.log("3. Removing project with ID:", project.id)
    await store.removeProject(project.id)
    console.log("4. Project removed successfully!")
  } catch (error) {
    console.error("Error occurred:", error)
  }
}

run()
