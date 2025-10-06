import { HTMLAttributes, useContext, useEffect, useRef, useState } from "react";

import { BackCard } from "../BackCard/BackCard";
import { cn } from "@/utils/cn";
import { PositionsContext } from "@/context/PositionsContext";
import { createPortal } from "react-dom";

interface AnimatedCard {
  id: number;
  x: number;
  y: number;
  delay: number;
  animate: boolean;
}

interface Props extends HTMLAttributes<HTMLDivElement> {}

const MAX_ROUNDS = 3;

export function CardsDeck({ className }: Props) {
  const { changeDeckPosition, playersPositions, deckPosition } =
    useContext(PositionsContext);
  const cardsDeckArray = new Array(6).fill(1);
  const ref = useRef<HTMLDivElement>(null);
  const [isStartDistribution, setIsStartDistribution] = useState(true);
  const [animatedCards, setAnimatedCards] = useState<AnimatedCard[]>([]);

  useEffect(() => {
    const onResizeHandler = () => {
      if (!ref.current) return;

      const refPosition = ref.current.getBoundingClientRect();

      changeDeckPosition({
        x: refPosition.x,
        y: refPosition.y,
      });
    };

    onResizeHandler();

    document.addEventListener("resize", onResizeHandler);

    return () => document.removeEventListener("resize", onResizeHandler);
  }, []);

  useEffect(() => {
    if (!isStartDistribution) return;

    const cards: AnimatedCard[] = [];

    let counter = 0;

    const CARD_WIDTH = 32;
    const CARD_HEIGHT = 44;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      for (
        let playerIndex = 0;
        playerIndex < playersPositions.length;
        playerIndex++
      ) {
        const pos = playersPositions[playerIndex];

        const offsetX = round * MAX_ROUNDS;

        const targetXLeft = pos.x + CARD_WIDTH - 30 + offsetX;
        const targetXRight = pos.x + CARD_WIDTH + 60 + offsetX;
        const targetY = pos.y - CARD_HEIGHT + 85;

        cards.push({
          id: counter,
          x: pos.cardSide === "left" ? targetXLeft : targetXRight,
          y: targetY,
          delay: counter * 300,
          animate: false,
        });

        counter++;
      }
    }

    setAnimatedCards(cards);

    requestAnimationFrame(() => {
      setAnimatedCards(cards.map((c) => ({ ...c, animate: true })));
    });
  }, [playersPositions, deckPosition, isStartDistribution]);

  return (
    <div
      className={cn(
        "absolute bottom-24 left-1/2 -translate-x-1/2 z-30",
        className
      )}
      ref={ref}
      id="cards-deck"
    >
      <div className="relative w-8 h-11">
        {cardsDeckArray.map((_, index) => (
          <BackCard
            className="absolute w-full h-full"
            style={{ bottom: index + "px" }}
          />
        ))}

        {animatedCards.map((card) => {
          return createPortal(
            <BackCard
              key={card.id}
              className="fixed w-8 h-11"
              data-name="animate-card"
              style={{
                zIndex: 30,
                left: deckPosition?.x + "px",
                top: deckPosition?.y + "px",
                transform: card.animate
                  ? `translate(${card.x - (deckPosition?.x || 0)}px, ${
                      card.y - (deckPosition?.y || 0)
                    }px)`
                  : "translate(0, 0)",
                transition: "transform 0.5s ease",
                transitionDelay: `${card.delay}ms`,
              }}
            />,
            document.body
          );
        })}
      </div>
    </div>
  );
}
