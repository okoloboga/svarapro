import { WithNull } from "@/types/mainTypes";
import { createContext, ReactNode, useState } from "react";

interface PositionElement {
  x: number;
  y: number;
}

interface PositionsContextState {
  deckPosition: WithNull<PositionElement>;
  playersPositions: PositionElement[];
  changeDeckPosition: (position: WithNull<PositionElement>) => void;
  changePlayersPositions: (positions: PositionElement[]) => void;
  addPlayerPosition: (position: PositionElement) => void;
}

export const PositionsContext = createContext<PositionsContextState>({
  deckPosition: null,
  playersPositions: [],
  changeDeckPosition: () => {},
  changePlayersPositions: () => {},
  addPlayerPosition: () => {},
});

interface Props {
  children: ReactNode;
}

export function PositionsProvider({ children }: Props) {
  const [deckPosition, setDeckPosition] =
    useState<WithNull<PositionElement>>(null);
    const [playersPositions, setPlayersPositions] = useState<PositionElement[]>([]);

  const changeDeckPosition = (position: WithNull<PositionElement>) => {
    setDeckPosition(position);
  };

  const changePlayersPositions = (positions: PositionElement[]) => {
    setPlayersPositions(positions);
  }

  const addPlayerPosition = (position: PositionElement) => {
    setPlayersPositions((prev) => [...prev, position]);
  }

  return (
    <PositionsContext.Provider value={{ deckPosition, playersPositions, changeDeckPosition, changePlayersPositions, addPlayerPosition }}>
      {children}
    </PositionsContext.Provider>
  );
}
