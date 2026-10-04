"use client";

import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import type { PreparedImage } from "@/lib/image";
import { fromEstimate, itemsFromRegular, roundMacros, scaleMacros, totalMacros } from "@/lib/items";
import { blurOnEnter, submitOnEnter } from "@/lib/keyboard";
import { requestAnalysis, requestEstimate, type AnalyzeFailure } from "@/lib/meal-api";
import type { Analysis, LabelReading, Macros, MealItem, MealLog, ProductInfo, SavedMeal } from "@/lib/types";
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
  | { kind: "adjust"; regular: SavedMeal }
  | { kind: "edit"; regular: SavedMeal }
  | { kind: "log"; log: MealLog };

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

/** A regular as changed in the edit sheet. */
export type RegularChanges = { name: string; macros: Macros; items?: MealItem[]; product?: ProductInfo };

/** A logged meal as corrected in the edit sheet. */
export type LogChanges = { name: string; macros: Macros; items?: MealItem[] };

type MealSheetProps = {
  request: SheetRequest | null;
  regulars: SavedMeal[];
  onLog: (entry: LogEntry) => void;
  onLogRegular: (regular: SavedMeal) => void;
  onSaveRegular: (id: string, changes: RegularChanges) => void;
  onRemoveRegular: (regular: SavedMeal) => void;
  onSaveLog: (id: string, changes: LogChanges) => void;
  onDeleteLog: (log: MealLog) => void;
  onClose: () => void;
};

function sheetKey(request: SheetRequest): string {
  if (request.kind === "photo") return request.image.dataUrl;
  if (request.kind === "text") return "text";
  if (request.kind === "log") return `log-${request.log.id}`;
  return `${request.kind}-${request.regular.id}`;
}

export function MealSheet({ request, ...rest }: MealSheetProps) {
  const { onClose } = rest;
  return (
    <Sheet open={request !== null} labelledBy="meal-heading" onClose={onClose}>
      {request && (
        <MealFlow
          key={sheetKey(request)}
          request={request}
          {...rest}
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
  /** The regular being edited: the sheet saves it instead of logging a meal. */
  editing?: SavedMeal;
  /** The logged meal being corrected: the sheet saves it in place. */
  editingLog?: MealLog;
};

type Stage =
  | { name: "compose"; failure?: AnalyzeFailure; detail?: string }
  | { name: "reading" }
  | { name: "review"; review: Review }
  | { name: "label"; reading: LabelReading };

/** Unsure items first, so the ones worth checking are at the top; order is fixed once, never while editing. */
const uncertainFirst = (items: MealItem[]) =>
  [...items].sort((a, b) => Number(Boolean(b.uncertain)) - Number(Boolean(a.uncertain)));

const asValues = (macros: Macros): MacroValues => ({
  protein: String(macros.protein),
  kcal: String(macros.kcal),
  carbs: String(macros.carbs),
  fat: String(macros.fat),
});

function initialStage(request: SheetRequest): Stage {
  if (request.kind === "text") return { name: "compose", failure: request.failure };
  if (request.kind === "photo") return { name: "compose" };
  if (request.kind === "log") {
    const { log } = request;
    const items = log.items?.map((item) => ({ ...item })) ?? [];
    return {
      name: "review",
      review: {
        name: log.name,
        items,
        canSave: false,
        // A meal logged as typed totals has no items, so its totals are what gets corrected.
        totals: items.length ? null : asValues(log.macros),
        editingLog: log,
      },
    };
  }
  const { regular } = request;
  const editing = request.kind === "edit" ? regular : undefined;
  return {
    name: "review",
    review: {
      name: regular.name,
      items: itemsFromRegular(regular),
      savedMealId: regular.id,
      canSave: false,
      // A product is edited as its label values for one serving.
      totals: editing?.product ? asValues(regular.macros) : null,
      editing,
    },
  };
}

const TITLES: Record<SheetRequest["kind"], string> = {
  photo: "New meal",
  text: "Describe a meal",
  adjust: "Adjust before logging",
  edit: "Edit regular",
  log: "Edit meal",
};

type MealFlowProps = Omit<MealSheetProps, "request"> & { request: SheetRequest };

function MealFlow({
  request,
  regulars,
  onLog,
  onLogRegular,
  onSaveRegular,
  onRemoveRegular,
  onSaveLog,
  onDeleteLog,
  onClose,
}: MealFlowProps) {
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
      if (!result.ok) return setStage({ name: "compose", failure: result.reason, detail: result.detail });
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
    if (!result.ok) return setStage({ name: "compose", failure: result.reason, detail: result.detail });
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
              {stage.detail && <span className={`mono ${styles.failureDetail}`}>details: {stage.detail}</span>}
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
          onSaveRegular={onSaveRegular}
          onRemoveRegular={onRemoveRegular}
          onSaveLog={onSaveLog}
          onDeleteLog={onDeleteLog}
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
  onSaveRegular: (id: string, changes: RegularChanges) => void;
  onRemoveRegular: (regular: SavedMeal) => void;
  onSaveLog: (id: string, changes: LogChanges) => void;
  onDeleteLog: (log: MealLog) => void;
};

/** A product's per-100 values follow an edited serving, so it still works by weight as an ingredient. */
function editedProduct(product: ProductInfo, perServing: Macros): ProductInfo {
  if (!product.per100 || product.servingSize <= 0) return product;
  return { ...product, per100: roundMacros(scaleMacros(perServing, 100 / product.servingSize)) };
}

function ReviewStage({
  review,
  onChange,
  regulars,
  outside,
  photo,
  onLog,
  onLogRegular,
  onSaveRegular,
  onRemoveRegular,
  onSaveLog,
  onDeleteLog,
}: ReviewStageProps) {
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

  const { editing, editingLog } = review;
  const product = editing?.product;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    const name = review.name.trim();
    const items = typed ? undefined : review.items;
    if (editingLog) return onSaveLog(editingLog.id, { name, macros, items });
    if (editing) {
      return onSaveRegular(editing.id, {
        name,
        macros,
        // A product keeps its one-serving item; otherwise typed totals replace the items.
        items: product ? editing.items : items,
        product: product && editedProduct(product, macros),
      });
    }
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
              regulars={editing ? regulars.filter((regular) => regular.id !== editing.id) : regulars}
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
            {product ? `per ${product.servingLabel} · ${product.servingSize} ${product.servingUnit}` : "total"}
          </h3>
          {review.items.length > 0 && !product && (
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
            legend={product ? `Values for one ${product.servingLabel}` : "Totals for this meal"}
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

      <button type="submit" className={styles.primary} disabled={!valid} data-autofocus={review.name && !editing && !editingLog ? "" : undefined}>
        {editing || editingLog ? "Save changes" : `Log ${macros.protein} g protein`}
      </button>
      {editingLog && (
        <button type="button" className={`${styles.textButton} ${styles.destructive}`} onClick={() => onDeleteLog(editingLog)}>
          Delete meal
        </button>
      )}
      {editing && (
        <button type="button" className={`${styles.textButton} ${styles.destructive}`} onClick={() => onRemoveRegular(editing)}>
          Remove from regulars
        </button>
      )}
    </form>
  );
}
