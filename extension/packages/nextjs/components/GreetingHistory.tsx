"use client";

import { Address } from "@scaffold-ui/components";
import { formatEther } from "viem";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-eth";

type Greeting = {
  id: string;
  text: string;
  setterId: `0x${string}`;
  premium: boolean;
  value: bigint;
  blockNumber: bigint;
};

export const GreetingHistory = () => {
  const { data: events, isLoading } = useScaffoldEventHistory({
    contractName: "YourContract",
    eventName: "GreetingChange",
    watch: true,
    blockData: true,
  });

  // Map events to Greeting format
  const greetings: Greeting[] = events
    ? events.map(event => ({
        id: `${event.blockNumber}-${event.logIndex}`,
        text: event.args.newGreeting || "",
        setterId: (event.args.greetingSetter || "0x0") as `0x${string}`,
        premium: event.args.premium || false,
        value: event.args.value || BigInt(0),
        blockNumber: event.blockNumber || BigInt(0),
      }))
    : [];

  if (isLoading) {
    return (
      <div className="flex items-center flex-col flex-grow pt-12">
        <div className="loading loading-dots loading-md"></div>
      </div>
    );
  }

  if (!greetings || greetings.length === 0) {
    return (
      <div className="flex items-center flex-col flex-grow pt-4">
        <p className="text-center text-xl font-bold">No greetings found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {greetings.map(greeting => (
        <div
          key={greeting.id}
          className={`card bg-base-100 shadow-xl w-full max-w-2xl mx-auto ${greeting.premium ? "border-3 border-success" : ""}`}
        >
          <div className="card-body">
            <p className="text-4xl font-bold mb-2 text-center">{greeting.text}</p>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <Address address={greeting.setterId} />
            </div>
            {greeting.premium && (
              <div className="flex items-center gap-2 mt-2 flex-wrap justify-center">
                <span className="badge badge-primary">Premium (Ξ{formatEther(greeting.value)})</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
