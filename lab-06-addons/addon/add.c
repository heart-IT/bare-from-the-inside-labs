#include <bare.h>
#include <js.h>

static js_value_t *
add(js_env_t *env, js_callback_info_t *info) {
  size_t argc = 2;
  js_value_t *argv[2];
  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  double a, b;
  js_get_value_double(env, argv[0], &a);
  js_get_value_double(env, argv[1], &b);

  js_value_t *sum;
  js_create_double(env, a + b, &sum);
  return sum;
}

static js_value_t *
init(js_env_t *env, js_value_t *exports) {
  js_value_t *fn;
  js_create_function(env, "add", -1, add, NULL, &fn);
  js_set_named_property(env, exports, "add", fn);
  return exports;
}

BARE_MODULE(add, init)
