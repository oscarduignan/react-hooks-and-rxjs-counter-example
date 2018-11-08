import React, { useState, useEffect, useRef } from "react";
import { interval, fromEvent, merge } from "rxjs";
import { map, scan, takeUntil, switchMap, filter } from "rxjs/operators";
import ReactDOM from "react-dom";

import "./styles.css";

class LocalStorageCache {
  constructor(key, transform = x => x) {
    this.key = key;
    this.transform = transform;
  }

  get = defaultValue =>
    this.transform(window.localStorage.getItem(this.key) || defaultValue);

  set = newValue => window.localStorage.setItem(this.key, newValue);
}

const initialCount = 0;

function useCounter(initialCount = 0, cache) {
  let [count, setCount] = useState(
    cache ? cache.get(initialCount) : initialCount
  );

  useEffect(() => cache && cache.set(count), [count]);

  return [
    count,
    {
      increment: () => setCount(count => count + 1),
      decrement: () => setCount(count => count - 1),
      reset: () => setCount(initialCount)
    }
  ];
}

function useAutoIncrementer(increment, startRunning = false, timeout = 1000) {
  let [running, setRunning] = useState(startRunning);

  useEffect(
    () => {
      if (running) {
        let timer = setInterval(increment, timeout);

        return () => clearInterval(timer);
      }
    },
    [running]
  );

  return [running, () => setRunning(running => !running)];
}

function App({ initialCount, countCache }) {
  let [count, { increment, decrement, reset }] = useCounter(
    initialCount,
    countCache
  );
  let [autoIncrementing, toggleAutoIncrement] = useAutoIncrementer(increment);

  // observable tinkering below
  let incrementBtn = useRef();
  let decrementBtn = useRef();
  let resetBtn = useRef();
  let autoIncrementBtn = useRef();
  let [observableCount, setObservableCount] = useState(
    countCache ? countCache.get(initialCount) : initialCount
  );
  useEffect(() => {
    let autoIncrementStateChanges = fromEvent(
      autoIncrementBtn.current,
      "click"
    ).pipe(scan(x => (x === "started" ? "stopped" : "started"), "stopped"));

    // TODO: refactor this so it's clearer to scan at a glance?
    let subscription = merge(
      merge(
        fromEvent(incrementBtn.current, "click"),
        autoIncrementStateChanges.pipe(
          filter(x => x === "started"),
          switchMap(y =>
            interval(1000).pipe(takeUntil(autoIncrementStateChanges))
          )
        )
      ).pipe(map(() => count => count + 1)),
      fromEvent(decrementBtn.current, "click").pipe(
        map(() => count => count - 1)
      ),
      fromEvent(resetBtn.current, "click").pipe(map(() => count => 0))
    )
      .pipe(scan((count, f) => f(count), observableCount))
      .subscribe(setObservableCount);

    return () => subscription.unsubscribe();
  }, []); // important to have [] at end, so this only happens at component mount and unmount

  return (
    <div className="App">
      <h1>
        Count currently at {count} (rxjs: {observableCount})
      </h1>
      <div>
        <button ref={incrementBtn} onClick={increment}>
          Increment
        </button>
        <button ref={decrementBtn} onClick={decrement}>
          Decrement
        </button>
      </div>
      <div>
        <button ref={autoIncrementBtn} onClick={toggleAutoIncrement}>
          {autoIncrementing
            ? "stop auto incrementing"
            : "start auto incrementing"}
        </button>
      </div>
      <div
        style={{
          display: count !== initialCount ? "block" : "none"
        }}
      >
        <button ref={resetBtn} onClick={reset}>
          Reset count
        </button>
      </div>
      <p>Should persist following a page refresh</p>
    </div>
  );
}

const rootElement = document.getElementById("root");
ReactDOM.render(
  <App
    initialCount={initialCount}
    countCache={new LocalStorageCache("count", x => Number(x))}
  />,
  rootElement
);
