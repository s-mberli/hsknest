import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Meanings } from "../../components/words/Meanings";

describe("Meanings", () => {
  it("renders an alternate reading for a single structured meaning", () => {
    const html = renderToStaticMarkup(
      <Meanings
        word={{
          translation: "to finish",
          phonetic: "liǎo",
          metadata: { meanings: [{ gloss: "to finish", reading: "liào" }] },
        }}
      />
    );

    expect(html).toContain("liào");
    expect(html).toContain("to finish");
  });
});
