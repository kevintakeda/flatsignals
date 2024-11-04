
import { vi, expect, test } from "vitest";
import { effect, root, signal, tick } from "../src/index.js";

test("effects", () => {
  root(() => {
    const a = signal(1);
    const b = signal(2);
    const cSpy = vi.fn(() => a.val + b.val);
    effect(cSpy);

    expect(cSpy).toHaveBeenCalledTimes(0);

    a.val = 10;
    tick();
    expect(cSpy).toHaveBeenCalledTimes(1);
    tick();
    expect(cSpy).toHaveBeenCalledTimes(1);

    b.val = 20;
    b.val = 30;
    tick();
    tick();
    expect(cSpy).toHaveBeenCalledTimes(2);
    tick();
    expect(cSpy).toHaveBeenCalledTimes(2);
  })
});

test("unsubscribe invisible dependencies", () => {
  root(() => {
    const a = signal(true);
    const b = signal("b");
    const c = signal("c");
    const fSpy = vi.fn(() => a.val ? b.val : c.val);
    effect(fSpy);

    tick();
    expect(fSpy).toHaveBeenCalledTimes(1);
    a.val = false;
    tick();
    expect(fSpy).toHaveBeenCalledTimes(2);
    a.val = true;
    c.val = "c!";
    c.val = "c!!";
    tick();
    expect(fSpy).toHaveBeenCalledTimes(3);
    a.val = false;
    b.val = "b!";
    b.val = "b!!"
    tick();
    expect(fSpy).toHaveBeenCalledTimes(4);
    a.val = false;
    tick();
    expect(fSpy).toHaveBeenCalledTimes(4);
    b.val = "b!!!";
    tick();
    expect(fSpy).toHaveBeenCalledTimes(4);
  })
});

// test("nested effects run once", () => {
//   root(() => {
//     const a = signal(2);
//     const spyX = vi.fn(() => a.val);
//     const spyY = vi.fn(() => a.val);
//     const spyZ = vi.fn(() => a.val);
//     effect(() => {
//       spyX();
//       effect(() => {
//         spyY();
//         effect(() => {
//           spyZ();
//         });
//       });
//     });

//     expect(spyX).toHaveBeenCalledTimes(0);
//     expect(spyY).toHaveBeenCalledTimes(0);
//     expect(spyZ).toHaveBeenCalledTimes(0);

//     tick();
//     expect(spyX).toHaveBeenCalledTimes(1);
//     expect(spyY).toHaveBeenCalledTimes(1);
//     expect(spyZ).toHaveBeenCalledTimes(1);

//     a.val = 4;
//     a.val = 8;
//     expect(spyX).toHaveBeenCalledTimes(1);
//     expect(spyY).toHaveBeenCalledTimes(1);
//     expect(spyZ).toHaveBeenCalledTimes(1);

//     tick();
//     expect(spyX).toHaveBeenCalledTimes(2);
//     expect(spyY).toHaveBeenCalledTimes(2);
//     expect(spyZ).toHaveBeenCalledTimes(2);
//     expect(a.val).toBe(8);
//   })
// });

test("dispose effects", () => {
  root(() => {
    const a = signal("a");
    const bSpy = vi.fn(() => a.val);
    const dispose = effect(bSpy);
    expect(bSpy).toHaveBeenCalledTimes(0);

    // set a
    a.val = "a!";
    tick();
    expect(bSpy).toHaveBeenCalledTimes(1);
    a.val = "a!!";
    tick();
    expect(bSpy).toHaveBeenCalledTimes(2);
    dispose();
    bSpy.mockReset();

    a.val = "a!!!";
    tick();
    expect(bSpy).toHaveBeenCalledTimes(0);
    a.val = "a!!!!";
    tick();
    expect(bSpy).toHaveBeenCalledTimes(0);
    expect(bSpy).toHaveBeenCalledTimes(0);
  })
});

test("effect with conditional dependencies", () => {
  root(() => {
    const s1 = signal(true);
    const s2 = signal("a");
    const s3 = signal("b");
    const s4 = signal(() => s2.val);
    const s5 = signal(() => s3.val);
    let result = { val: 0 };
    effect(
      () => {
        if (s1.val) {
          s4.val;
          result.val = 1;
        } else {
          s5.val;
          result.val = 0;
        }
      }
    );
    s1.val = false;
    tick();
    expect(result.val).toBe(0);
    s1.val = true;
    tick();
    expect(result.val).toBe(1);
  })
});

test("effect with deep dependencies", () => {
  root(() => {
    const a = signal(2);
    const spyB = vi.fn(() => a.val + 1);
    const b = signal(spyB);
    const spyC = vi.fn(() => b.val);
    const c = signal(spyC);
    const spyD = vi.fn(() => c.val);
    const d = signal(spyD);
    const spyE = vi.fn(() => d.val);
    effect(spyE);
    tick();
    expect(spyE).toHaveBeenCalledTimes(1);
    a.val = 4;
    tick();
    expect(spyE).toHaveBeenCalledTimes(2);
  })
});
