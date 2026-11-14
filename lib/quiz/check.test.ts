import { describe, expect, it } from "vitest";
import { checkQuestion, type DraftQuestion } from "./check";

// John 3:1-2 and 6:9, KJV (from content/kjv).
const JHN3 = [
  "There was a man of the Pharisees, named Nicodemus, a ruler of the Jews:",
  "The same came to Jesus by night, and said unto him, Rabbi, we know that thou art a teacher come from God: for no man can do these miracles that thou doest, except God be with him.",
];
const JHN6 = [...Array(8).fill("..."), "There is a lad here, which hath five barley loaves, and two small fishes: but what are they among so many?"];

const good: DraftQuestion = {
  chapter: 3,
  verse_start: 1,
  verse_end: 2,
  difficulty: "easy",
  question: "Which Pharisee came to Jesus by night?",
  choices: ["Gamaliel", "Nicodemus", "Caiaphas", "Saul"],
  answer: 1,
  evidence: "named Nicodemus",
};

describe("checkQuestion", () => {
  it("passes a question whose answer comes from words copied from the verses", () => {
    expect(checkQuestion(good, JHN3)).toEqual([]);
  });

  it("knows numbers are written as words in the KJV", () => {
    const q: DraftQuestion = { ...good, chapter: 6, verse_start: 9, verse_end: 9, question: "How many barley loaves did the lad have?", choices: ["Three", "5", "Seven", "Twelve"], answer: 1, evidence: "five barley loaves" };
    expect(checkQuestion(q, JHN6)).toEqual([]);
  });

  it("refuses evidence that isn't in the text exactly", () => {
    expect(checkQuestion({ ...good, evidence: "a man called Nicodemus" }, JHN3)).toContain("the evidence isn't copied exactly from the verses");
  });

  it("refuses an answer the evidence doesn't support", () => {
    expect(checkQuestion({ ...good, answer: 0 }, JHN3)).toContain("the correct choice doesn't come from the evidence");
  });

  it("refuses a question where a second choice is also supported", () => {
    const q: DraftQuestion = { ...good, question: "What was Nicodemus called?", choices: ["Pharisees", "a ruler of the Jews", "a fisherman", "a publican"], answer: 1, evidence: "a man of the Pharisees, named Nicodemus, a ruler of the Jews" };
    expect(checkQuestion(q, JHN3)).toContain("choice 1 is also supported by the evidence");
  });

  it("refuses verses that don't exist, odd choices, and giveaways", () => {
    expect(checkQuestion({ ...good, verse_end: 40 }, JHN3)).toEqual(["the verses don't exist"]);
    expect(checkQuestion({ ...good, choices: ["Nicodemus", "nicodemus", "Saul", "Paul"], answer: 0 }, JHN3)).toContain("two choices are the same");
    expect(checkQuestion({ ...good, choices: ["A", "B", "Nicodemus"] }, JHN3)).toContain("needs four short choices");
    expect(checkQuestion({ ...good, question: "Did Nicodemus come by night?" }, JHN3)).toContain("the question gives the answer away");
    expect(checkQuestion({ ...good, question: "Who came" }, JHN3)).toContain("the question isn't a 10 to 300 character question");
  });
});
