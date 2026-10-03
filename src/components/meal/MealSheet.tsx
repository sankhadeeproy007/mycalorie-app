"use client";

import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import type { PreparedImage } from "@/lib/image";
import { fromEstimate, itemsFromRegular, totalMacros } from "@/lib/items";
import { blurOnEnter, submitOnEnter } from "@/lib/keyboard";
import { requestAnalysis, requestEstimate, type AnalyzeFailure } from "@/lib/meal-api";
import type { Analysis, LabelReading, Macros, MealItem, ProductInfo, SavedMeal } from "@/lib/types";
import { SwitchRow } from "../SwitchRow";
import { EMPTY_MACRO_VALUES, MacroFields, parseAmount, Sheet, SheetHeader, type MacroValues } from "../Sheet";
import { AddItemPanel } from "./AddItemPanel";
import { FAILURE_COPY } from "./failure-copy";
import { ItemRow } from "./ItemRow";
import { LabelReview } from "./LabelReview";
import styles from "./MealSheet.module.css";

/** What opened the sheet. */
export type SheetRequest =
  | { kind: "photo"; image: PreparedImage; file: File }
  /** `failure` explains why a photo couldn't be used, when the sheet falls back to describing. */
  | { kind: "text"; failure?: AnalyzeFailure }
  | { kind: "adjust"; regular: SavedMeal };

/** The photo as sent and what the AI said about it, before any correction. */
export type PhotoCapture = { image: PreparedImage; hint: string; outside: boolean; estimate: Analysis | null };

/** What to log, already as eaten; `saveAs` also keeps it as a regular. */
export type LogEntry = {
  name: string;
  macros: Macros;
  items?: MealItem[];
  savedMealId?: string;
  photoFile?: File;
  saveAs?: { name: string; macros: Macros; items?: MealItem[]; product?: ProductInfo };
  /** Present when the meal came from a photo; kept for model comparison if that's switched on. */
  capture?: PhotoCapture;
};

type MealSheetProps = {
  request: SheetRequest | null;
  regulars: SavedMeal[];
  onLog: (entry: LogEntry) => void;
  onLogRegular: (regular: SavedMeal) => void;
  onClose: () => void;
};

export function MealSheet({ request, regulars, onLog, onLogRegular, onClose }: MealSheetProps) {
  return (
    <Sheet open={request !== null} labelledBy="meal-heading" onClose={onClose}>
      {request && (
        <MealFlow
          key={request.kind === "photo" ? request.image.dataUrl : request.kind === "adjust" ? request.regular.id : "text"}
          request={request}
          regulars={regulars}
          onLog={onLog}
          onLogRegular={onLogRegular}
          onClose={onClose}
        />
      )}
    </Sheet>
  );
}

type Review = {
  name: string;
  items: MealItem[];
  matched?: SavedMeal;
  savedMealId?: string;
  /** Adjusting a regular logs a one-off; it is never re-saved from here. */
  canSave: boolean;
  /** Set when the totals were typed directly instead of summed from items. */
  totals: MacroValues | null;
};

type Stage =
  | { name: "compose"; failure?: AnalyzeFailure }
  | { name: "reading" }
  | { name: "review"; review: Review }
  | { name: "label"; reading: LabelReading };

/** Unsure items first, so the ones worth checking are at the top; order is fixed once, never while editing. */
const uncertainFirst = (items: MealItem[]) =>
  [...items].sort((a, b) => Number(Boolean(b.uncertain)) - Number(Boolean(a.uncertain)));

function initialStage(request: SheetRequest): Stage {
  if (request.kind === "text") return { name: "compose", failure: request.failure };
  if (request.kind === "photo") return { name: "compose" };
  return {
    name: "review",
    review: {
      name: request.regular.name,
      items: itemsFromRegular(request.regular),
      savedMealId: request.regular.id,
      canSave: false,
      totals: null,
    },
  };
}

const TITLES: Record<SheetRequest["kind"], string> = { photo: "New meal", text: "Describe a meal", adjust: "Adjust before logging" };

type MealFlowProps = Omit<MealSheetProps, "request"> & { request: SheetRequest };

function MealFlow({ request, regulars, onLog, onLogRegular, onClose }: MealFlowProps) {
  const [stage, setStage] = useState<Stage>(() => initialStage(request));
  const [hint, setHint] = useState("");
  const [outside, setOutside] = useState(false);
  const [estimate, setEstimate] = useState<Analysis | null>(null);

  const photo = request.kind === "photo" ? request : null;
  const logWithCapture = (entry: LogEntry) =>
    onLog(photo ? { ...entry, capture: { image: photo.image, hint: hint.trim(), outside, estimate } } : entry);
  const regularsById = new Map(regulars.map((regular) => [regular.id, regular]));

  const startReview = (name: string, items: MealItem[], matched?: SavedMeal) =>
    setStage({ name: "review", review: { name, items: uncertainFirst(items), matched, canSave: true, totals: null } });

  const read = async (event: FormEvent) => {
    event.preventDefault();
    if (photo) {
      setStage({ name: "reading" });
      const result = await requestAnalysis(photo.image, { hint: hint.trim(), outside, regulars });
      if (!result.ok) return setStage({ name: "compose", failure: result.reason });
      const analysis = result.value;
      setEstimate(analysis);
      if (analysis.kind === "label") return setStage({ name: "label", reading: analysis.label });
      const matched = analysis.matchedRegularId ? regularsById.get(analysis.matchedRegularId) : undefined;
      return startReview(analysis.name, analysis.items.map(fromEstimate), matched);
    }

    const description = hint.trim();
    if (!description) return;
    setStage({ name: "reading" });
    const result = await requestEstimate(description, outside);
    if (!result.ok) return setStage({ name: "compose", failure: result.reason });
    startReview(result.value.name, result.value.items.map(fromEstimate));
  };

  const enterByHand = () =>
    setStage({ name: "review", review: { name: "", items: [], canSave: true, totals: EMPTY_MACRO_VALUES } });

  return (
    <div className={styles.flow}>
      <SheetHeader id="meal-heading" title={stage.name === "label" ? "Nutrition label" : TITLES[request.kind]} onClose={onClose} />

      {stage.name === "compose" && (
        <form className={styles.stage} onSubmit={read}>
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element -- local data URL
            <img src={photo.image.dataUrl} alt="Your meal" className={styles.preview} />
          )}
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{photo ? "Anything the photo can’t show?" : "What did you eat?"}</span>
            <textarea
              className={styles.textArea}
              value={hint}
              onChange={(event) => setHint(event.target.value)}
              placeholder={photo ? "e.g. 3 eggs, 1 tsp ghee" : "e.g. 2 rotis and a katori of dal"}
              rows={2}
              maxLength={300}
              enterKeyHint="go"
              onKeyDown={submitOnEnter}
              data-autofocus={photo ? undefined : ""}
              required={!photo}
            />
          </label>
          <SwitchRow
            label="Outside food"
            hint="Restaurant, dhaba, street food or delivery: assumes more oil and bigger portions"
            on={outside}
            onChange={setOutside}
          />

          {stage.failure && (
            <p className={styles.failure} role="alert">
              {FAILURE_COPY[stage.failure]}
            </p>
          )}

          <button type="submit" className={styles.primary} disabled={!photo && !hint.trim()}>
            {photo ? "Read photo" : "Estimate"}
          </button>
          <button type="button" className={styles.textButton} onClick={enterByHand}>
            Enter numbers instead
          </button>
        </form>
      )}

      {stage.name === "reading" && (
        <div className={styles.stage} role="status">
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element -- local data URL
            <img src={photo.image.dataUrl} alt="" className={styles.preview} />
          )}
          <p className={`mono ${styles.readingText}`}>{photo ? "reading your plate…" : "estimating…"}</p>
          <span className={styles.progress} aria-hidden="true">
            <span />
          </span>
        </div>
      )}

      {stage.name === "label" && (
        <LabelReview reading={stage.reading} photoFile={photo?.file} photoUrl={photo?.image.dataUrl} onLog={logWithCapture} />
      )}

      {stage.name === "review" && (
        <ReviewStage
          review={stage.review}
          onChange={(review) => setStage({ name: "review", review })}
          regulars={regulars}
          outside={outside}
          photo={photo}
          onLog={logWithCapture}
          onLogRegular={onLogRegular}
        />
      )}
    </div>
  );
}

type ReviewStageProps = {
  review: Review;
  onChange: (review: Review) => void;
  regulars: SavedMeal[];
  outside: boolean;
  photo: { file: File } | null;
  onLog: (entry: LogEntry) => void;
  onLogRegular: (regular: SavedMeal) => void;
};

function ReviewStage({ review, onChange, regulars, outside, photo, onLog, onLogRegular }: ReviewStageProps) {
  const [adding, setAdding] = useState(false);
  const [saveToRegulars, setSaveToRegulars] = useState(false);

  const summed = totalMacros(review.items);
  const typed = review.totals;
  const macros: Macros = typed
    ? {
        protein: parseAmount(typed.protein) ?? 0,
        kcal: parseAmount(typed.kcal) ?? 0,
        carbs: parseAmount(typed.carbs) ?? 0,
        fat: parseAmount(typed.fat) ?? 0,
      }
    : summed;
  const valid = review.name.trim() !== "" && (typed ? parseAmount(typed.protein) !== null : review.items.length > 0);

  const setItems = (items: MealItem[]) => onChange({ ...review, items });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    const name = review.name.trim();
    const items = typed ? undefined : review.items;
    onLog({
      name,
      macros,
      items,
      savedMealId: review.savedMealId,
      photoFile: photo?.file,
      saveAs: review.canSave && saveToRegulars ? { name, macros, items } : undefined,
    });
  };

  return (
    <form className={styles.stage} onSubmit={submit}>
      {review.matched && (
        <div className={styles.match}>
          <p>
            Looks like your regular <strong>{review.matched.name}</strong>
            <span className="mono"> · {review.matched.items ? totalMacros(review.matched.items).protein : review.matched.macros.protein} g</span>
          </p>
          <button type="button" className={styles.secondaryButton} onClick={() => onLogRegular(review.matched!)}>
            Log that instead
          </button>
        </div>
      )}

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Meal name</span>
        <input
          className={styles.textInput}
          value={review.name}
          onChange={(event) => onChange({ ...review, name: event.target.value })}
          placeholder="e.g. Rajma chawal"
          autoComplete="off"
          enterKeyHint="done"
          onKeyDown={blurOnEnter}
          data-autofocus={review.name ? undefined : ""}
          required
        />
      </label>

      {!typed && (
        <section className={styles.block} aria-labelledby="items-heading">
          <h3 id="items-heading" className={styles.blockTitle}>
            items
          </h3>
          {review.items.length > 0 && (
            <ul className={styles.items}>
              {review.items.map((item, index) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onChange={(next) => setItems(review.items.map((entry, at) => (at === index ? next : entry)))}
                  onRemove={() => setItems(review.items.filter((_, at) => at !== index))}
                />
              ))}
            </ul>
          )}
          {adding ? (
            <AddItemPanel
              regulars={regulars}
              outside={outside}
              onAddRegular={(regular) => {
                setItems([...review.items, ...itemsFromRegular(regular)]);
                setAdding(false);
              }}
              onAddEstimated={(estimated) => {
                setItems([...review.items, ...estimated.map(fromEstimate)]);
                setAdding(false);
              }}
            />
          ) : (
            <button type="button" className={styles.addButton} onClick={() => setAdding(true)}>
              <Plus size={16} strokeWidth={2} aria-hidden="true" />
              add
            </button>
          )}
        </section>
      )}

      <section className={styles.block} aria-labelledby="totals-heading">
        <div className={styles.blockHead}>
          <h3 id="totals-heading" className={styles.blockTitle}>
            total
          </h3>
          {review.items.length > 0 && (
            <button
              type="button"
              className={styles.textButton}
              onClick={() =>
                onChange({
                  ...review,
                  totals: typed
                    ? null
                    : {
                        protein: String(summed.protein),
                        kcal: String(summed.kcal),
                        carbs: String(summed.carbs),
                        fat: String(summed.fat),
                      },
                })
              }
            >
              {typed ? "Use items" : "Edit totals"}
            </button>
          )}
        </div>
        {typed ? (
          <MacroFields
            legend="Totals for this meal"
            values={typed}
            onChange={(totals) => onChange({ ...review, totals })}
            required={["protein"]}
          />
        ) : (
          <p className={`mono ${styles.totals}`}>
            <span className={styles.totalProtein}>
              {summed.protein}
              <span className={styles.totalUnit}>g</span>
            </span>
            <span>
              {summed.kcal} kcal · {summed.carbs} g carbs · {summed.fat} g fat
            </span>
          </p>
        )}
      </section>

      {review.canSave && (
        <label className={styles.save}>
          <input type="checkbox" checked={saveToRegulars} onChange={(event) => setSaveToRegulars(event.target.checked)} />
          <span>
            <span className={styles.saveLabel}>Save to regulars</span>
            <span className={styles.saveHint}>
              {photo ? "Keeps a small copy of the photo. " : ""}Log it again later with one tap.
            </span>
          </span>
        </label>
      )}

      <button type="submit" className={styles.primary} disabled={!valid} data-autofocus={review.name ? "" : undefined}>
        Log {macros.protein} g protein
      </button>
    </form>
  );
}
