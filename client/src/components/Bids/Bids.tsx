import { PositionsContext } from "@/context/PositionsContext";
import { cn } from "@/utils/cn";
import { HTMLAttributes, useContext, useEffect, useRef, useState } from "react";
import { Coin } from "../Coin/Coin";
import { GameStatuses } from "@/types/game";

interface Props extends HTMLAttributes<HTMLDivElement> {
  bet?: number;
  gameStatus?: GameStatuses;
}

export function Bids({ className, gameStatus }: Props) {
  const { changeBidsPosition } = useContext(PositionsContext);
  const ref = useRef<HTMLDivElement>(null);
  const chipsArray = new Array(2).fill(1);
  const [showBids, setShowBids] = useState(false);

  useEffect(() => {
    const onResizeHandler = () => {
      if (!ref.current) return;

      const refPosition = ref.current.getBoundingClientRect();

      changeBidsPosition({
        x: refPosition.x,
        y: refPosition.y,
      });
    };

    onResizeHandler();

    document.addEventListener("resize", onResizeHandler);

    return () => document.removeEventListener("resize", onResizeHandler);
  }, []);

  useEffect(() => {
    if(gameStatus !== 'ante') return;

    const timeout = setTimeout(() => {
      setShowBids(true);
    }, 1000)

    return () => clearTimeout(timeout);
  }, [gameStatus])

  if(!showBids) return null;

  return (
    <div
      className={cn(
        "absolute top-[57.5%] left-[47%] -translate-x-1/2 z-30",
        className
      )}
      id="bids"
      ref={ref}
    >
      <div className="relative">
        <div className="w-[20px] flex flex-col">
          {chipsArray.map((_, index) => (
            <Coin
              key={index}
              className="absolute left-0 z-30"
              style={{
                top: `${-index * 4}px`,
              }}
            />
          ))}
        </div>
        <div className="w-[20px] flex flex-col translate-x-[74%] -mt-1">
          {chipsArray.map((_, index) => (
            <Coin
              key={index}
              className="absolute left-0 z-30"
              style={{
                top: `${-index * 4}px`,
              }}
            />
          ))}
        </div>
        <div className="w-[20px] flex flex-col translate-x-[71%] translate-y-2">
          {chipsArray.map((_, index) => (
            <Coin
              key={index}
              className="absolute left-0 z-30"
              style={{
                top: `${-index * 4}px`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
