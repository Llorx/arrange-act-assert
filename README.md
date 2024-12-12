# arrange-act-assert
Act-Arrange-Assert oriented testing tool.

# Motivation
Focusing lately in unitary testing, I noticed that I wanted to reduce the amount of *brain cycles* that I waste designing and reading tests, so I started adding `// Act // Arrange // Assert` [comments to all my tests](https://github.com/goldbergyoni/javascript-testing-best-practices?tab=readme-ov-file#section-0%EF%B8%8F%E2%83%A3-the-golden-rule) so it helps me to notice when something is not in the proper section and also helps identifying each section on first sight, but there's a thing I love more than testing: design-oriented development. Humans are fallible so I prefer for the tool or project premise to force me to follow methodologies and good practices instead of me applying my own rules over my workflow. The more good practices you are forced to do, the less chances to have a problem because, for example, you had a headache one day and you didn't notice a mistake.

With this idea, I created the Act-Arrange-Assert testing tool that reduces the amount of *brain cycles* wasted when you have to read and design your tests.

For example, having this test using NodeJS test runner:
```typescript
import test from "node:test";
import Assert from "node:assert";

import { MyFactory } from "./MyFactory";
import { MyBase } from "./MyBase";

test("should do that thing properly", () => {
    const baseOptions = {
        a: 1,
        b: 2,
        c: 3,
        d: 4
    };
    const base = new MyBase(baseOptions);
    base.open();
    test.after(() => base.close());
    base.setData("a", 2);
    const factory = new MyFactory();
    test.after(() => factory.dispose());
    const processor = factory.getProcessor();
    const data = processor.processBase(base);
    Assert.deepScriptEqual(data, {
        a: 2,
        b: 27
    });
});
```
Try to read and understand the different implicit sections. You notice how you had to spend *brain cycles* to understand it. To improve this test I would do something like this:
```typescript
import test from "node:test";
import Assert from "node:assert";

import { MyFactory } from "./MyFactory";
import { MyBase } from "./MyBase";

test("should do that thing properly", () => {
    // Arrange
    const baseOptions = {
        a: 1,
        b: 2,
        c: 3,
        d: 4
    };
    const base = new MyBase(baseOptions);
    test.after(() => base.close());
    base.open();
    base.setData("a", 2);
    const factory = new MyFactory();
    test.after(() => factory.dispose());
    const processor = factory.getProcessor();
    // Act
    const data = processor.processBase(base);
    // Assert
    Assert.deepScriptEqual(data, {
        a: 2,
        b: 27
    });
});
```
This helps to differenciate the sections, for example helping you to avoid mixing the the `// Act` and `// Assert` sections like this:
```typescript
Assert.deepScriptEqual(processor.processBase(base), {...}); // Bad
```
Still I don't like the idea of just using comments, because that's a rule I've set to myself. The tool itself stills allows me to do weird things that maybe some day I do for whatever reason.

With `arrange-act-assert` it helps design a test like this:
```typescript
import test from "arrange-act-assert";
import Assert from "node:assert";

import { MyFactory } from "./MyFactory";
import { MyBase } from "./MyBase";

test("should do that thing properly", {
    ARRANGE(after) {
        const baseOptions = {
            a: 1,
            b: 2,
            c: 3,
            d: 4
        };
        const base = after(new MyBase(baseOptions), item => item.close());
        base.open();
        base.setData("a", 2);
        const factory = after(new MyFactory(), item => item.close());
        const processor = factory.getProcessor();
        return { base, processor };
    },
    ACT({ base, processor }) {
        return processor.processBase(base);
    },
    ASSERT(data) {
        Assert.deepScriptEqual(data, {
            a: 2,
            b: 27
        });
    }
});
```
If you actually read the code, I bet that one of the first things that you saw were the uppercase sections. I can hear you screaming "ugh those uppercase section names!" and that's precisely my pitch: they're noticeable, they're easy to see, THEY'RE UPPERCASE, so you wasted almost no *brain cycles* identifying them.

The tool, by design, helped you to differenciate the method that you are trying to test (the `processBase()` inside the ACT) and what result it should return (the `{ a: 2, b: 27 }` inside the ASSERT).

Apart from that, the `after` callback has a different approach. It wraps the item to be cleared and returns it in the callback function. This way the item to be cleared is directly linked to the callback that will clear it.

And that's very much it.

# Documentation
WIP