import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AiBuilderLanding from "./components/ai-builder/AiBuilderLanding";

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/brain-builder");
  }

  return <AiBuilderLanding />;
}
