// src/declarations.d.ts
declare module 'react-player' {
    import { ComponentType } from 'react';
    export interface ReactPlayerProps {
        url?: string | string[] | any[];
        playing?: boolean;
        loop?: boolean;
        controls?: boolean;
        volume?: number;
        muted?: boolean;
        playbackRate?: number;
        width?: string | number;
        height?: string | number;
        style?: object;
        progressInterval?: number;
        playsinline?: boolean;
        config?: any;
        onReady?: () => void;
        onStart?: () => void;
        onPlay?: () => void;
        onPause?: () => void;
        onBuffer?: () => void;
        onBufferEnd?: () => void;
        onEnded?: () => void;
        onDuration?: (duration: number) => void;
        onProgress?: (state: { played: number; playedSeconds: number; loaded: number; loadedSeconds: number }) => void;
        [key: string]: any;
    }
    const ReactPlayer: ComponentType<ReactPlayerProps>;
    export default ReactPlayer;
}

declare module 'react-player/lazy' {
    import ReactPlayer from 'react-player';
    export default ReactPlayer;
}