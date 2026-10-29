import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="mx-auto mt-24 max-w-md text-center">
      <h1 className="text-lg font-semibold">You don’t have access to this area</h1>
      <p className="mt-2 text-sm text-slate-500">Your role does not include this module. Ask a Biz Group admin if you need access.</p>
      <Link href="/portfolio" className="mt-4 inline-block text-sm underline">Back to Portfolio</Link>
    </div>
  );
}
