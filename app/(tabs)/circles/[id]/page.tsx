import { Suspense } from "react";
import { CircleScreen } from "@/components/lamplighters/CircleScreen";
import { LoadingRows } from "@/components/lamplighters/States";

export const metadata = { title: "Circle" };

// Circles are private and loaded in the browser (row-level security decides what shows),
// so the id is only read at request time.
export default function CirclePage({ params }: PageProps<"/circles/[id]">) {
  return (
    <Suspense fallback={<LoadingRows rows={4} label="Loading the Circle" />}>
      {params.then(({ id }) => (
        <CircleScreen id={id} />
      ))}
    </Suspense>
  );
}
