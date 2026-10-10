import type { Metadata } from "next";
import { BackgroundSlideshow } from "../background-slideshow";
import { TalkClient } from "./talk-client";

export const metadata: Metadata = { title: "Talk · Aangan Receptionist" };

export default function TalkPage() {
  return (
    <>
      <BackgroundSlideshow />
      <main className="shell talk-shell">
        <TalkClient />
      </main>
    </>
  );
}
