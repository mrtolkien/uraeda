//! The engine of one VM, on its thread: QuickJS with its limits, the prelude's parts, and the
//! pieces of the extension's code it runs, one command or one timer at a time.

use std::cell::RefCell;
use std::collections::{BTreeMap, HashMap};
use std::rc::Rc;
use std::sync::atomic::Ordering;
use std::sync::mpsc::{Receiver, RecvTimeoutError, SyncSender};
use std::time::{Duration, Instant};

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD;
use rquickjs::context::EvalOptions;
use rquickjs::{
    CaughtError, Coerced, Context, Ctx, Exception, Function, Module, Object, Persistent, Runtime,
    TypedArray,
};
use serde_json::{Value, json};

use super::{ACTIVATION, CALL, Command, End, Host, MEMORY, STACK, Thrown, Vm, over};

/// What the VM's thread keeps between two pieces of code.
#[derive(Default)]
struct Local {
    /// The calls waiting for the extension's answer, by their id.
    waiting: HashMap<u64, SyncSender<Result<Value, String>>>,
    /// The timers, by when each fires next, then by id: its interval, when it repeats.
    timers: BTreeMap<(Instant, u64), Option<Duration>>,
    /// When each timer fires next.
    due: HashMap<u64, Instant>,
    /// What the extension's code threw where nothing waited for an answer.
    failure: Option<Thrown>,
    /// The rejections nothing handles yet, and the last one's words.
    rejected: i64,
    rejection: Option<Thrown>,
}

impl Local {
    fn set_timer(&mut self, id: u64, after: Duration, every: bool) {
        // An interval of nothing would leave the thread no pause.
        let after = after.max(Duration::from_millis(1));
        let at = Instant::now() + after;
        self.due.insert(id, at);
        self.timers.insert((at, id), every.then_some(after));
    }

    fn clear_timer(&mut self, id: u64) {
        if let Some(at) = self.due.remove(&id) {
            self.timers.remove(&(at, id));
        }
    }

    /// The timers due now, each set again when it repeats.
    fn due_timers(&mut self) -> Vec<u64> {
        let now = Instant::now();
        let mut due = Vec::new();
        while let Some((&(at, id), &every)) = self.timers.first_key_value() {
            if at > now {
                break;
            }
            self.timers.remove(&(at, id));
            self.due.remove(&id);
            if let Some(every) = every {
                self.set_timer(id, every, true);
            }
            due.push(id);
        }
        due
    }

    /// The operations the VM answers itself: none for one that is the host's.
    fn op(&mut self, op: &str, payload: &Value) -> Option<Result<Value, String>> {
        let id = payload["id"].as_u64().unwrap_or_default();
        match op {
            "reply" => {
                let answer = match payload["ok"].as_bool() {
                    Some(true) => Ok(payload["value"].clone()),
                    _ => Err(payload["error"].as_str().unwrap_or_default().to_owned()),
                };
                if let Some(waiting) = self.waiting.remove(&id) {
                    let _ = waiting.try_send(answer);
                }
            }
            "timer.set" => {
                let millis = payload["ms"].as_f64().unwrap_or_default().clamp(0.0, 1e12);
                let every = payload["every"].as_bool().unwrap_or_default();
                self.set_timer(id, Duration::from_secs_f64(millis / 1000.0), every);
            }
            "timer.clear" => self.clear_timer(id),
            "fail" => {
                let text = |field: &str| payload[field].as_str().unwrap_or_default().to_owned();
                self.failure.get_or_insert(Thrown {
                    message: text("message"),
                    stack: text("stack"),
                });
            }
            _ => return None,
        }
        Some(Ok(Value::Null))
    }
}

/// The engine of one VM, on its thread. Its fields drop in this order: the function before
/// its context, and the context before its runtime.
pub(super) struct Machine {
    dispatch: Persistent<Function<'static>>,
    context: Context,
    runtime: Runtime,
    local: Rc<RefCell<Local>>,
    vm: Vm,
}

impl Machine {
    /// Starts the engine with its limits, and runs the prelude.
    pub(super) fn start(vm: &Vm, host: &Rc<RefCell<Box<dyn Host>>>) -> Result<Machine, Thrown> {
        let failed =
            |error: rquickjs::Error| Thrown::of(format!("its VM could not start: {error}"));
        let runtime = Runtime::new().map_err(failed)?;
        runtime.set_memory_limit(MEMORY);
        runtime.set_max_stack_size(STACK);
        let limited = vm.clone();
        runtime.set_interrupt_handler(Some(Box::new(move || limited.0.limits.over())));
        let local = Rc::new(RefCell::new(Local::default()));
        let tracked = local.clone();
        runtime.set_host_promise_rejection_tracker(Some(Box::new(
            move |_ctx, _promise, reason, handled| {
                let mut local = tracked.borrow_mut();
                if handled {
                    local.rejected -= 1;
                } else {
                    local.rejected += 1;
                    local.rejection = Some(thrown_value(&reason));
                }
            },
        )));
        let context = Context::full(&runtime).map_err(failed)?;
        let installed = context.with(|ctx| {
            let dispatch = install(&ctx, vm, &local, host);
            dispatch.map_err(|error| thrown(&ctx, error))
        });
        Ok(Machine {
            dispatch: installed?,
            context,
            runtime,
            local,
            vm: vm.clone(),
        })
    }

    /// Loads the extension, then serves its commands and its timers until it ends.
    pub(super) fn run(
        &mut self,
        commands: &Receiver<Command>,
        graph: &Value,
        loaded: &mut Option<SyncSender<Result<(), Thrown>>>,
    ) -> End {
        if let Err(end) = self.piece(ACTIVATION, "to load", "activate", graph) {
            return end;
        }
        if let Some(loaded) = loaded.take() {
            let _ = loaded.send(Ok(()));
        }
        loop {
            if let Err(end) = self.serve(commands) {
                return end;
            }
        }
    }

    /// Fires the timers due, then waits for one command, or for the next timer.
    fn serve(&mut self, commands: &Receiver<Command>) -> Result<(), End> {
        let due = self.local.borrow_mut().due_timers();
        for id in due {
            self.piece(CALL, "in a timer", "timer", &json!({ "id": id }))?;
        }
        let next = self.local.borrow().timers.keys().next().map(|(at, _)| *at);
        let command = match next {
            Some(at) => match commands.recv_timeout(at.saturating_duration_since(Instant::now())) {
                Ok(command) => command,
                Err(RecvTimeoutError::Timeout) => return Ok(()),
                Err(RecvTimeoutError::Disconnected) => return Err(End::Stopped),
            },
            None => commands.recv().map_err(|_| End::Stopped)?,
        };
        match command {
            Command::Stop => Err(End::Stopped),
            Command::Dispatch { kind, payload } => {
                self.piece(CALL, "in a callback", kind, &payload)
            }
            Command::Call { mut payload, reply } => {
                payload["id"] = match reply {
                    Some(reply) => {
                        let id = self.vm.next_id();
                        self.local.borrow_mut().waiting.insert(id, reply);
                        json!(id)
                    }
                    None => Value::Null,
                };
                self.piece(CALL, "in a call", "call", &payload)
            }
        }
    }

    /// Runs one piece of the extension's code, the prelude's `dispatch` of `kind`, and the
    /// promise jobs it leaves, within `limit`: the VM's end when it must not go on.
    fn piece(
        &mut self,
        limit: Duration,
        doing: &str,
        kind: &str,
        payload: &Value,
    ) -> Result<(), End> {
        let limits = &self.vm.0.limits;
        limits.begin(limit);
        let (dispatch, json) = (self.dispatch.clone(), payload.to_string());
        let called = self.context.with(|ctx| {
            let call = || dispatch.restore(&ctx)?.call::<_, ()>((kind, json));
            call().map_err(|error| thrown(&ctx, error))
        });
        let ran = called.and_then(|()| self.jobs());
        let cut = limits.end();
        if limits.stop.load(Ordering::SeqCst) {
            return Err(End::Stopped);
        }
        if cut {
            return Err(End::Failed(over(limit, doing)));
        }
        ran.map_err(End::Failed)?;
        let mut local = self.local.borrow_mut();
        let unhandled = (local.rejected > 0)
            .then(|| local.rejection.take())
            .flatten();
        local.rejected = 0;
        match local.failure.take().or(unhandled) {
            Some(thrown) => Err(End::Failed(thrown)),
            None => Ok(()),
        }
    }

    /// Runs the promise jobs waiting, to the last.
    fn jobs(&self) -> Result<(), Thrown> {
        loop {
            match self.runtime.execute_pending_job() {
                Ok(true) => {}
                Ok(false) => return Ok(()),
                Err(failed) => {
                    return Err(failed.0.with(|ctx| thrown_value(&ctx.catch())));
                }
            }
        }
    }
}

/// The parts of the prelude, in the order they are made: each a module of `api/`, whose default
/// export takes the host's natives and the parts made before it, and gives its own.
const PARTS: [(&str, &str); 4] = [
    ("guard", include_str!("../api/guard.js")),
    ("web", include_str!("../api/web.js")),
    ("modules", include_str!("../api/modules.js")),
    ("prelude", include_str!("../api/prelude.js")),
];

/// Gives the prelude its natives, makes its parts, and takes the last one's `dispatch`.
fn install<'js>(
    ctx: &Ctx<'js>,
    vm: &Vm,
    local: &Rc<RefCell<Local>>,
    host: &Rc<RefCell<Box<dyn Host>>>,
) -> rquickjs::Result<Persistent<Function<'static>>> {
    let (vm, local, host) = (vm.clone(), local.clone(), host.clone());
    let name = vm.name().to_owned();
    let host_call = move |ctx: Ctx<'_>, op: String, json: String| -> rquickjs::Result<String> {
        let throw = |message: &str| Exception::throw_message(&ctx, message);
        let payload: Value =
            serde_json::from_str(&json).map_err(|error| throw(&error.to_string()))?;
        let own = local.borrow_mut().op(&op, &payload);
        let answer = own.unwrap_or_else(|| host.borrow_mut().op(&vm, &op, payload));
        answer
            .map(|value| value.to_string())
            .map_err(|message| throw(&message))
    };
    let given = Object::new(ctx.clone())?;
    given.set("name", name)?;
    given.set("call", Function::new(ctx.clone(), host_call)?)?;
    given.set("compile", Function::new(ctx.clone(), compile)?)?;
    given.set("fromBase64", Function::new(ctx.clone(), from_base64)?)?;
    given.set("toBase64", Function::new(ctx.clone(), to_base64)?)?;
    given.set("decodeText", Function::new(ctx.clone(), decode_text)?)?;
    given.set("encodeText", Function::new(ctx.clone(), encode_text)?)?;
    let parts = Object::new(ctx.clone())?;
    for (part, source) in PARTS {
        let module = Module::declare(ctx.clone(), format!("uraeda:{part}"), source)?;
        let (module, loaded) = module.eval()?;
        loaded.finish::<()>()?;
        let make: Function = module.namespace()?.get("default")?;
        let made: rquickjs::Value = make.call((given.clone(), parts.clone()))?;
        parts.set(part, made)?;
    }
    let prelude: Object = parts.get("prelude")?;
    let dispatch: Function = prelude.get("dispatch")?;
    Ok(Persistent::save(ctx, dispatch))
}

/// One compiled file as a function of `(__import, __exports)`, named for its stack traces.
fn compile<'js>(ctx: Ctx<'js>, code: String, filename: String) -> rquickjs::Result<Function<'js>> {
    // Each compiled file says itself that it is strict.
    let mut options = EvalOptions::default();
    options.filename = Some(filename);
    options.strict = false;
    ctx.eval_with_options(
        format!("(function (__import, __exports) {{{code}\n}})"),
        options,
    )
}

fn from_base64<'js>(ctx: Ctx<'js>, text: String) -> rquickjs::Result<TypedArray<'js, u8>> {
    let bytes = STANDARD
        .decode(text)
        .map_err(|error| Exception::throw_message(&ctx, &error.to_string()))?;
    TypedArray::new(ctx, bytes)
}

fn to_base64(bytes: TypedArray<'_, u8>) -> String {
    STANDARD.encode(copied(&bytes))
}

fn decode_text(bytes: TypedArray<'_, u8>) -> String {
    String::from_utf8_lossy(&copied(&bytes)).into_owned()
}

/// A copy of an array's bytes: none of a detached one.
fn copied(bytes: &TypedArray<'_, u8>) -> Vec<u8> {
    // SAFETY: the slice is the engine's memory, valid until its code runs again: it is copied
    // here, before this native returns to the engine.
    let held = unsafe { bytes.as_bytes() };
    held.map(<[u8]>::to_vec).unwrap_or_default()
}

fn encode_text<'js>(ctx: Ctx<'js>, text: String) -> rquickjs::Result<TypedArray<'js, u8>> {
    TypedArray::new(ctx, text.into_bytes())
}

/// What a failed call into the engine threw.
fn thrown(ctx: &Ctx<'_>, error: rquickjs::Error) -> Thrown {
    match CaughtError::from_error(ctx, error) {
        CaughtError::Exception(exception) => thrown_exception(&exception),
        CaughtError::Value(value) => thrown_value(&value),
        CaughtError::Error(error) => Thrown::of(error.to_string()),
    }
}

fn thrown_exception(exception: &Exception<'_>) -> Thrown {
    Thrown {
        message: exception.message().unwrap_or_default(),
        stack: exception.stack().unwrap_or_default(),
    }
}

/// A thrown value's words: an error's message and stack, or the value as a text.
fn thrown_value(value: &rquickjs::Value<'_>) -> Thrown {
    let exception = value.as_object().cloned().and_then(Exception::from_object);
    if let Some(exception) = exception {
        return thrown_exception(&exception);
    }
    let text = value.get::<Coerced<String>>().map(|text| text.0);
    Thrown::of(text.unwrap_or_else(|_| "it threw a value with no words".to_owned()))
}
