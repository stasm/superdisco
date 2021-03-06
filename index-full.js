g.clearColor(1, .7, 0, 1);
g.enable(g.DEPTH_TEST);
g.enable(g.CULL_FACE);

// The number of voxels along the edge of the world.
let EDGE_COUNT = 707,
    shader,
    vertices = Float32Array.of(
        1, 9, 1, -1, 9, 1, -1, -9, 1,
        1, -9, 1, 1, 9, 1, -1, -9, 1,
        1, 9, 1, 1, -9, 1, 1, -9, -1,
        1, 9, -1, 1, 9, 1, 1, -9, -1,
        1, 9, 1, 1, 9, -1, -1, 9, -1,
        -1, 9, 1, 1, 9, 1, -1, 9, -1,
        -1, -9, -1, -1, 9, -1, 1, 9, -1,
        1, -9, -1, -1, -9, -1, 1, 9, -1,
        -1, -9, -1, -1, -9, 1, -1, 9, 1,
        -1, 9, -1, -1, -9, -1, -1, 9, 1,
        -1, -9, -1, 1, -9, -1, 1, -9, 1,
        -1, -9, 1, -1, -9, -1, 1, -9, 1
    ),
    compile_shader = (type, source) => {
        shader = g.createShader(type);
        g.shaderSource(shader, source);
        g.compileShader(shader);

        if (!g.getShaderParameter(shader, g.COMPILE_STATUS)) // DEBUG
            throw new Error(g.getShaderInfoLog(shader)); // DEBUG

        return shader;
    },
    mousex = 0.6,
    mousey = 0.6,
    audio,
    program = g.createProgram(),
    uniform_now, uniform_mouse,
    timestamp = 0,
    processor,
    tick = now => {
        timestamp = now;
        g.clear(16640);
        g.uniform3iv(uniform_now, Float32Array.of(now, mousex, mousey));
        // g.uniform2f(uniform_mouse, mousex, mousey);
        g.drawArraysInstanced(g.TRIANGLES, 0, 36, EDGE_COUNT * EDGE_COUNT);

        requestAnimationFrame(tick);
    };

g.attachShader(program, compile_shader(g.VERTEX_SHADER, `#version 300 es
    uniform ivec3 n;
    // Vertex position in the mesh
    in vec3 p;
    // Vertex position in the instance
    out vec4 f;

    // Projection matrix
    const mat4 P=mat4(
        1.299,0.,0.,0.,
        0.,1.732,0.,0.,
        0.,0.,-1.002,-1.,
        0.,0.,-2.002,0.);

    // Compute the translation of the instance
    vec3 t(float id,float o){
        float x=-${EDGE_COUNT}.+mod(id,${EDGE_COUNT}.)*2.;
        float z=-${EDGE_COUNT}.+(id/${EDGE_COUNT}.)*2.;
        // Make offset discrete in increments of the cube's width.
        float Z=z+floor(o/2.)*2.;
        return vec3(
            x,
            floor(
                // y
                9.*sin(x/30.)*sin(Z/20.)
                // Hills and valleys
                +99.*sin(x/99.)*sin(Z/299.)
                // Random noise, constant for a given (x, Z)
                +4.*fract(sin(Z)*99.)),
            z-mod(o,2.));
    }

    void main(){
        // The offset of the world
        float o=float(n.x)/99.;
        // The position of the camera
        float y=9.*sin(-o/30.)+30.;

        // Yaw
        float a=float(n.y)*0.0063;
        // Pitch
        float b=float(n.z)*0.0016-.8;

        f = P * mat4(
            cos(a),sin(a)*sin(b),-sin(a)*cos(b),0.,
            0.,cos(b),sin(b),0.,
            sin(a),-cos(a)*sin(b),cos(a)*cos(b),0.,
            0.,-y,0.,1.)*vec4(p+t(float(gl_InstanceID),o),1.);
        gl_Position=f;
    }
`));
g.attachShader(program, compile_shader(g.FRAGMENT_SHADER, `#version 300 es
    precision lowp float;

    // Fragment position
    in vec4 f;
    // Fragment color
    out vec4 c;

    void main(){
        c=mix(
            // Normal of the fragment
            vec4(normalize(cross(dFdx(f).xyz,dFdy(f).xyz)),1.),
            // Fog color
            vec4(1.,.7,0.,1.),
            // Divide length by max fog distance
            clamp(length(f-vec4(0.))/999.,0.,1.));
    }
`));
g.linkProgram(program);

uniform_now = g.getUniformLocation(program, "n");


// And make it the only active one.
g.useProgram(program);
// Buffer vertex data for a cube.
g.bindBuffer(g.ARRAY_BUFFER, g.createBuffer());
g.bufferData(g.ARRAY_BUFFER, vertices, g.STATIC_DRAW);
g.enableVertexAttribArray(0);
g.vertexAttribPointer(0, 3, g.FLOAT, g.FALSE, 0, 0);
b.onmousemove = e => {
    mousex = e.x;
    mousey = e.y;
};

b.onclick = e => {
    if (!audio) {
        audio = new AudioContext();
        processor = audio.createScriptProcessor(2048);
        processor.onaudioprocess = o => {
            for (i = 2048; i--;) {
                o.outputBuffer.getChannelData(0)[i] =
                    Math.sin(timestamp / i) / 99 * mousey;
            }
        };
        processor.connect(audio.destination);
    }
};

tick(0);
