import { PositionElement, PositionsContext } from "@/context/PositionsContext";
import { cn } from "@/utils/cn";
import { getChipsCountFromBet } from "@/utils/getChipsCountFromBet";
import { HTMLAttributes, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Coin } from "../Coin/Coin";

interface Props extends HTMLAttributes<HTMLDivElement> {
  bet?: number;
  playerPosition: PositionElement;
}

interface AnimatedChip {
  id: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  delay: number;
  animate: boolean;
  faded: boolean;
}

export const PlayerBetAnimation = ({
  className,
  bet,
  playerPosition,
}: Props) => {
  const { bidsPosition } = useContext(PositionsContext);
  const [isPlayAnimation, setIsPlayAnimation] = useState(false);
  const chipsCount = getChipsCountFromBet(bet || 0);
  const [animatedChips, setAnimatedChips] = useState<AnimatedChip[]>([]);

  const playAnimation = () => setIsPlayAnimation(true);
  const stopAnimation = () => setIsPlayAnimation(false);

  useEffect(() => {
    if (!bet) return;

    playAnimation();

    const timeout = setTimeout(() => {
      stopAnimation();
    }, 5000); // чуть дольше, чтобы успели исчезнуть

    return () => clearTimeout(timeout);
  }, [bet]);

  useEffect(() => {
    if (!bidsPosition || !chipsCount) return;

    const chips: AnimatedChip[] = [];
    const CARD_WIDTH = 32;
    const CARD_HEIGHT = 44;

    for (let i = 0; i < chipsCount; i++) {
      const offsetX = i * 4;
      const offsetY = -i * 3;

      chips.push({
        id: i,
        startX: playerPosition.x,
        startY: playerPosition.y,
        targetX: bidsPosition.x + CARD_WIDTH - 30 + offsetX,
        targetY: bidsPosition.y - CARD_HEIGHT + 85 / 2 + offsetY,
        delay: i * 50,
        animate: false,
        faded: false,
      });
    }

    setAnimatedChips(chips);

    // Старт анимации движения
    requestAnimationFrame(() => {
      setAnimatedChips((prev) => prev.map((c) => ({ ...c, animate: true })));
    });

    const fadeTimeout = setTimeout(() => {
      setAnimatedChips((prev) => prev.map((c) => ({ ...c, faded: true })));
    }, 700);

    return () => clearTimeout(fadeTimeout);
  }, [bidsPosition, chipsCount, playerPosition]);

  if (!isPlayAnimation) return null;

  return (
    <div className={cn(className)}>
      {animatedChips.map((chip) =>
        createPortal(
          <Coin
            key={chip.id}
            className="fixed w-8 h-11"
            style={{
              zIndex: 30 + chip.id,
              left: chip.startX,
              top: chip.startY,
              transform: chip.animate
                ? `translate(${chip.targetX - chip.startX}px, ${
                    chip.targetY - chip.startY
                  }px)`
                : "translate(0, 0)",
              opacity: chip.faded ? 0 : 1,
              transition: `
                transform 0.8s cubic-bezier(0.25, 1, 0.5, 1),
                opacity 0.8s ease ${chip.delay + 3200}ms
              `,
              transitionDelay: `${chip.delay}ms`,
            }}
          />,
          document.body
        )
      )}
    </div>
  );
};
