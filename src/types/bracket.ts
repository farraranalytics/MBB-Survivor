// Bracket visualization types
import { Game, Round, TeamInfo } from './picks';

/** A game enriched with its round info for bracket display */
export interface BracketGame extends Game {
  round?: Round;
}

/** One round's worth of games within a region */
export interface BracketRound {
  round: Round;
  games: BracketGame[];
}

/** A full region bracket: region name + rounds progressing R1 → Elite 8 */
export interface RegionBracket {
  region: string;
  rounds: BracketRound[];
}
