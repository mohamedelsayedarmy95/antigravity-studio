import type { FilmSpecInput } from "../engine/schema/film";
import { m1CoreTest } from "./m1-core-test";
import { m2TypeData } from "./m2-type-data";

/** Every film here is registered automatically in each of its output aspects (see Root.tsx). */
export const FILMS: FilmSpecInput[] = [m1CoreTest, m2TypeData];
