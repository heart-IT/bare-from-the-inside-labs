#include <node_api.h>

static napi_value
add(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value argv[2];
  napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

  double a, b;
  napi_get_value_double(env, argv[0], &a);
  napi_get_value_double(env, argv[1], &b);

  napi_value sum;
  napi_create_double(env, a + b, &sum);
  return sum;
}

NAPI_MODULE_INIT() {
  napi_value fn;
  napi_create_function(env, "add", NAPI_AUTO_LENGTH, add, NULL, &fn);
  napi_set_named_property(env, exports, "add", fn);
  return exports;
}
