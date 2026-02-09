import React from "react";


interface ErrorProps {
    Type: string;
    Message: string;
}

export default function ErrorComponent({ Type, Message }: ErrorProps) {
    if (!Message) {
        return null;
    }
    
    const isSuccess = Type === "Message";

    return (
        <div
            className={`flex ${
                isSuccess ? "bg-green-500/70" : "bg-red-500/70"
            } w-full justify-start items-center p-2 gap-2 mt-2  transition-all`}
            role="alert"
        >
            <div className="shrink-0">
                {isSuccess ? (
                    "Message:"
                ) : (
                    "Error:"
                )}
            </div>
            <div className="flex-1">
                <p className="text-black text-sm font-medium">{Message}</p>
            </div>
        </div>
    );
}
