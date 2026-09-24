#include <bare.h>
#include <js.h>
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Finalizers may run on a thread of the engine's own, so what they report is
// written under a lock and read back from JavaScript with drain().
static pthread_mutex_t log_lock = PTHREAD_MUTEX_INITIALIZER;
static char log_text[1024];
static pthread_t js_thread;
static int exiting;

static void
report(const char *what, js_env_t *env) {
  const char *thread = pthread_equal(pthread_self(), js_thread) ? "the JS thread" : "another thread";
  char line[256];
  snprintf(line, sizeof(line), "finalizer for %s: env is %s, on %s\n", what, env == NULL ? "NULL" : "set", thread);

  // Once JavaScript has finished there is nobody left to drain the log.
  if (exiting) {
    fputs(line, stderr);
    return;
  }

  pthread_mutex_lock(&log_lock);
  strncat(log_text, line, sizeof(log_text) - strlen(log_text) - 1);
  pthread_mutex_unlock(&log_lock);
}

static js_value_t *
drain(js_env_t *env, js_callback_info_t *info) {
  pthread_mutex_lock(&log_lock);
  js_value_t *result;
  js_create_string_utf8(env, (utf8_t *) log_text, strlen(log_text), &result);
  log_text[0] = '\0';
  pthread_mutex_unlock(&log_lock);
  return result;
}

// 1. A handle kept past its call, and a reference that keeps the value.

static js_value_t *kept;
static js_ref_t *held;

static js_value_t *
keep(js_env_t *env, js_callback_info_t *info) {
  size_t argc = 1;
  js_value_t *argv[1];
  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  kept = argv[0];

  return NULL;
}

static js_value_t *
get_kept(js_env_t *env, js_callback_info_t *info) {
  return kept;
}

static js_value_t *
hold(js_env_t *env, js_callback_info_t *info) {
  size_t argc = 2;
  js_value_t *argv[2];
  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  uint32_t count;
  js_get_value_uint32(env, argv[1], &count);

  if (held) js_delete_reference(env, held);

  js_create_reference(env, argv[0], count, &held);

  return NULL;
}

static js_value_t *
get_held(js_env_t *env, js_callback_info_t *info) {
  js_value_t *value;
  js_get_reference_value(env, held, &value);

  if (value == NULL) js_get_null(env, &value);

  return value;
}

// 2. Bytes C lends to JavaScript.

static void
on_lent_finalize(js_env_t *env, void *data, void *hint) {
  report("the lent bytes", env);
  free(data);
}

static js_value_t *
lend(js_env_t *env, js_callback_info_t *info) {
  char *bytes = malloc(16);
  strcpy(bytes, "lent by C");

  js_value_t *arraybuffer;
  js_create_external_arraybuffer(env, bytes, 16, on_lent_finalize, NULL, &arraybuffer);

  return arraybuffer;
}

static js_value_t *
lend_and_free(js_env_t *env, js_callback_info_t *info) {
  char *bytes = malloc(16);
  strcpy(bytes, "lent by C");

  js_value_t *arraybuffer;
  js_create_external_arraybuffer(env, bytes, 16, NULL, NULL, &arraybuffer);

  free(bytes);

  return arraybuffer;
}

static js_value_t *
text(js_env_t *env, js_callback_info_t *info) {
  size_t argc = 1;
  js_value_t *argv[1];
  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  char *data;
  size_t len;
  js_get_arraybuffer_info(env, argv[0], (void **) &data, &len);

  char copy[16];
  size_t n = 0;
  while (n < len && n < sizeof(copy) && data[n] != '\0') {
    copy[n] = data[n];
    n++;
  }

  js_value_t *result;
  js_create_string_utf8(env, (utf8_t *) copy, n, &result);

  return result;
}

static js_value_t *
borrow(js_env_t *env, js_callback_info_t *info) {
  size_t argc = 1;
  js_value_t *argv[1];
  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  char scratch[16] = "on C's stack";

  js_value_t *arraybuffer;
  js_create_external_arraybuffer(env, scratch, sizeof(scratch), NULL, NULL, &arraybuffer);

  js_value_t *global;
  js_get_global(env, &global);
  js_call_function(env, global, argv[0], 1, &arraybuffer, NULL);

  js_detach_arraybuffer(env, arraybuffer);

  return NULL;
}

// 3. A pointer C hides inside a JavaScript object.

static void
on_wrap_finalize(js_env_t *env, void *data, void *hint) {
  report(data, env);
  free(data);
}

static js_value_t *
wrap(js_env_t *env, js_callback_info_t *info) {
  size_t argc = 2;
  js_value_t *argv[2];
  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  char *name = malloc(32);
  size_t len;
  js_get_value_string_utf8(env, argv[1], (utf8_t *) name, 31, &len);
  name[len] = '\0';

  if (js_wrap(env, argv[0], name, on_wrap_finalize, NULL, NULL) != 0) free(name);

  return NULL;
}

static js_value_t *
unwrap(js_env_t *env, js_callback_info_t *info) {
  size_t argc = 1;
  js_value_t *argv[1];
  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  char *name;
  if (js_unwrap(env, argv[0], (void **) &name) != 0) return NULL;

  js_value_t *result;
  js_create_string_utf8(env, (utf8_t *) name, strlen(name), &result);

  return result;
}

// 4. What runs when the environment is destroyed.

static void
on_teardown(void *data) {
  fputs("teardown callback: the environment is being destroyed\n", stderr);
}

static js_value_t *
add_teardown(js_env_t *env, js_callback_info_t *info) {
  js_add_teardown_callback(env, on_teardown, NULL);
  return NULL;
}

static js_value_t *
set_exiting(js_env_t *env, js_callback_info_t *info) {
  exiting = 1;
  return NULL;
}

static js_value_t *
init(js_env_t *env, js_value_t *exports) {
  js_thread = pthread_self();

  struct {
    const char *name;
    js_function_cb cb;
  } functions[] = {
    {"keep", keep},
    {"kept", get_kept},
    {"hold", hold},
    {"held", get_held},
    {"lend", lend},
    {"lendAndFree", lend_and_free},
    {"text", text},
    {"borrow", borrow},
    {"wrap", wrap},
    {"unwrap", unwrap},
    {"addTeardown", add_teardown},
    {"exiting", set_exiting},
    {"drain", drain},
  };

  for (size_t i = 0; i < sizeof(functions) / sizeof(functions[0]); i++) {
    js_value_t *fn;
    js_create_function(env, functions[i].name, -1, functions[i].cb, NULL, &fn);
    js_set_named_property(env, exports, functions[i].name, fn);
  }

  return exports;
}

BARE_MODULE(own, init)
