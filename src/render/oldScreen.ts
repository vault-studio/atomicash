// Filtro de pantalla vieja para el lienzo de la run: curvatura de tubo, aberración cromática hacia los bordes, tono de
// fósforo gastado, banda de luz que baja despacio y parpadeo leve. Las scanlines, el grano y la viñeta van en CSS
// (`.crt .run::after`) para que cubran también el HUD. Solo WebGL: con WebGPU no se aplica.
import { defaultFilterVert, Filter, GlProgram, UniformGroup } from 'pixi.js';
import { OLD_SCREEN } from '../config/render';

const fragment = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
// Misma precisión que en el vértice por defecto de Pixi: si no, el programa no enlaza.
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform highp vec4 uInputClamp;

uniform float uTime;
uniform float uCurve;
uniform float uAberration;
uniform float uRoll;
uniform float uFlicker;
uniform float uGrade;

vec4 tap(vec2 tc) {
  return texture(uTexture, clamp(tc, uInputClamp.xy, uInputClamp.zw));
}

void main() {
  vec2 frame = uOutputFrame.zw;
  vec2 toTex = frame * uInputSize.zw;
  vec2 uv = vTextureCoord / toTex;

  // Curvatura de tubo: las esquinas se van a negro con un borde suave.
  vec2 cc = uv - 0.5;
  float r2 = dot(cc, cc);
  vec2 cuv = 0.5 + cc * (1.0 + uCurve * r2);
  vec2 edge = smoothstep(vec2(0.0), vec2(0.004), cuv) * smoothstep(vec2(0.0), vec2(0.004), 1.0 - cuv);
  float inside = edge.x * edge.y;

  // Aberración: rojo y azul se separan más cuanto más lejos del centro.
  vec2 tc = cuv * toTex;
  vec2 off = cc * uAberration * (0.35 + r2 * 2.5) * uInputSize.zw;
  vec4 base = tap(tc);
  vec3 col = vec3(tap(tc + off).r, base.g, tap(tc - off).b);

  // Fósforo gastado: algo de desaturación, negros levantados y un punto cálido.
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(l), 0.18 * uGrade);
  col = col * vec3(1.04, 1.0, 0.9) * (1.0 - 0.04 * uGrade) + vec3(0.025, 0.02, 0.012) * uGrade;

  // Banda de luz que baja por la pantalla y parpadeo del tubo.
  float band = fract(uTime * 0.07);
  float d = abs(cuv.y - band);
  col *= 1.0 + uRoll * smoothstep(0.08, 0.0, d);
  col *= 1.0 - uFlicker * (0.5 + 0.5 * sin(uTime * 61.0) * sin(uTime * 23.0));

  finalColor = vec4(col * inside, 1.0);
}
`;

export class OldScreenFilter extends Filter {
  private readonly u: UniformGroup<{
    uTime: { value: number; type: 'f32' };
    uCurve: { value: number; type: 'f32' };
    uAberration: { value: number; type: 'f32' };
    uRoll: { value: number; type: 'f32' };
    uFlicker: { value: number; type: 'f32' };
    uGrade: { value: number; type: 'f32' };
  }>;

  constructor() {
    const u = new UniformGroup({
      uTime: { value: 0, type: 'f32' },
      uCurve: { value: OLD_SCREEN.curve, type: 'f32' },
      uAberration: { value: OLD_SCREEN.aberration, type: 'f32' },
      uRoll: { value: OLD_SCREEN.roll, type: 'f32' },
      uFlicker: { value: OLD_SCREEN.flicker, type: 'f32' },
      uGrade: { value: 1, type: 'f32' },
    });
    super({
      glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment, name: 'old-screen-filter' }),
      resources: { oldScreen: u },
      resolution: 'inherit',
    });
    this.u = u;
  }

  /** `t` en segundos. Con movimiento reducido no hay banda ni parpadeo. */
  update(t: number, reduceMotion: boolean): void {
    const v = this.u.uniforms;
    v.uTime = t;
    v.uRoll = reduceMotion ? 0 : OLD_SCREEN.roll;
    v.uFlicker = reduceMotion ? 0 : OLD_SCREEN.flicker;
  }
}
