export interface SignallingServerSpec {
    socket: SignallingServerSocketSpec,
    signallingApiBase: string;
}

export interface SignallingServerSocketSpec {
    server: string;
    socketResource?: string;
}